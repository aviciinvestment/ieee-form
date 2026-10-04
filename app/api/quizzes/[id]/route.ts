import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getManagerAccess, type ManagerAccess } from "@/lib/auth";
import { buildOptionCreates, parseQuizInput, type QuestionInput } from "@/lib/quiz";
import { resolveReferenceFiles } from "@/lib/pdf";

export const dynamic = "force-dynamic";

type LoadedQuiz =
  | {
      ok: true;
      quiz: Prisma.QuizGetPayload<{
        include: {
          questions: { include: { options: true } };
          _count: { select: { attempts: true } };
        };
      }>;
      access: Extract<ManagerAccess, { ok: true }>;
    }
  | { ok: false; status: number; error: string };

async function loadOwnedQuiz(req: Request, id: string): Promise<LoadedQuiz> {
  const access = await getManagerAccess(req);
  if (!access.ok) return { ok: false, status: access.status, error: access.error };

  const quiz = await prisma.quiz.findUnique({
    where: { id },
    include: {
      questions: {
        orderBy: { order: "asc" },
        include: { options: { orderBy: { order: "asc" } } },
      },
      _count: { select: { attempts: true } },
    },
  });

  if (!quiz) return { ok: false, status: 404, error: "Quiz not found." };
  if (access.role === "manager" && quiz.trackName !== access.trackName) {
    return { ok: false, status: 403, error: "You can only manage quizzes for your own track." };
  }

  return { ok: true, quiz, access };
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const loaded = await loadOwnedQuiz(req, params.id);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const { quiz } = loaded;
    return NextResponse.json({
      data: {
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        trackName: quiz.trackName,
        published: quiz.published,
        attemptCount: quiz._count.attempts,
        locked: quiz._count.attempts > 0,
        questions: quiz.questions.map((question, index) => ({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          points: question.points,
          explanation: question.explanation,
          order: index + 1,
          referenceFileUrl: question.referenceFileUrl,
          referenceFilePages: question.referenceFilePages,
          // Sent back so editing a quiz never silently drops the extracted reference text.
          referenceFileText: question.referenceFileText,
          options: question.options.map((option) => ({
            id: option.id,
            label: option.label,
            isCorrect: option.isCorrect,
          })),
        })),
      },
    });
  } catch (error) {
    console.error("Get Quiz Error:", error);
    return NextResponse.json({ error: "Internal server error while loading the quiz." }, { status: 500 });
  }
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const loaded = await loadOwnedQuiz(req, params.id);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    const { quiz } = loaded;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    if (typeof body !== "object" || body === null) {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }
    const raw = body as Record<string, unknown>;

    // Once somebody has taken the quiz the questions freeze so graded results stay valid.
    const attemptCount = await prisma.quizAttempt.count({ where: { quizId: quiz.id } });
    const contentLocked = attemptCount > 0;

    if (contentLocked && Array.isArray(raw.questions)) {
      return NextResponse.json(
        {
          error:
            "This quiz already has attempts, so its questions are locked. Create a new quiz if you need different questions.",
        },
        { status: 409 }
      );
    }

    const title = typeof raw.title === "string" ? raw.title.trim().slice(0, 160) : quiz.title;
    if (!title) {
      return NextResponse.json({ error: "Quiz title is required." }, { status: 400 });
    }
    const description =
      typeof raw.description === "string" ? raw.description.trim().slice(0, 2000) : quiz.description;
    const published = typeof raw.published === "boolean" ? raw.published : quiz.published;

    const requestedTrack = typeof raw.trackName === "string" ? raw.trackName.trim() : quiz.trackName;
    const track = await prisma.learningTrack.findUnique({ where: { name: requestedTrack } });
    if (!track) {
      return NextResponse.json({ error: "That learning track does not exist." }, { status: 400 });
    }
    if (loaded.access.role === "manager" && track.name !== loaded.access.trackName) {
      return NextResponse.json({ error: "You can only keep quizzes inside your own track." }, { status: 403 });
    }

    let questions: (QuestionInput & { referenceFilePages?: number; referenceFileText?: string })[] | null = null;
    if (!contentLocked) {
      const parsed = parseQuizInput({ ...raw, title, description, published });
      if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
      }
      // Extract the text of any reference PDF before the questions are written.
      questions = await resolveReferenceFiles(parsed.value.questions);
    }

    const keepIds = (questions ?? [])
      .map((question) => question.id)
      .filter((id): id is string => Boolean(id));

    // Never let a payload reference a question that belongs to another quiz.
    if (keepIds.length) {
      const ownedCount = await prisma.question.count({
        where: { id: { in: keepIds }, quizId: quiz.id },
      });
      if (ownedCount !== keepIds.length) {
        return NextResponse.json({ error: "One or more questions do not belong to this quiz." }, { status: 400 });
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.quiz.update({
        where: { id: quiz.id },
        data: { title, description, published, trackName: track.name },
      });

      if (questions) {
        await tx.question.deleteMany({
          where: { quizId: quiz.id, ...(keepIds.length ? { id: { notIn: keepIds } } : {}) },
        });

        for (const [index, question] of questions.entries()) {
          const data = {
            prompt: question.prompt,
            type: question.type,
            points: question.points,
            explanation: question.explanation,
            order: index + 1,
            referenceFileUrl: question.referenceFileUrl ?? "",
            referenceFilePages: question.referenceFilePages ?? 0,
            referenceFileText: question.referenceFileText ?? "",
          };

          if (question.id) {
            await tx.question.update({
              where: { id: question.id },
              data: { ...data, options: { deleteMany: {}, create: buildOptionCreates(question.options) } },
            });
          } else {
            await tx.question.create({
              data: { ...data, quizId: quiz.id, options: { create: buildOptionCreates(question.options) } },
            });
          }
        }
      }
    });

    return NextResponse.json({
      message: contentLocked ? "Quiz details updated successfully." : "Quiz updated successfully.",
      data: { id: quiz.id, attemptCount },
    });
  } catch (error) {
    console.error("Update Quiz Error:", error);
    return NextResponse.json({ error: "Internal server error while updating the quiz." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const loaded = await loadOwnedQuiz(req, params.id);
    if (!loaded.ok) {
      return NextResponse.json({ error: loaded.error }, { status: loaded.status });
    }

    await prisma.quiz.delete({ where: { id: loaded.quiz.id } });
    return NextResponse.json({ message: "Quiz deleted successfully.", id: loaded.quiz.id });
  } catch (error) {
    console.error("Delete Quiz Error:", error);
    return NextResponse.json({ error: "Internal server error while deleting the quiz." }, { status: 500 });
  }
}