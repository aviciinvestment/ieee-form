import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getManagerAccess } from "@/lib/auth";
import { parseQuizInput, totalPoints, buildQuestionCreates } from "@/lib/quiz";
import { resolveReferenceFiles } from "@/lib/pdf";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    const requestedTrack = new URL(req.url).searchParams.get("track")?.trim() ?? "";
    const scope =
      access.role === "manager" ? access.trackName : requestedTrack || undefined;

    const quizzes = await prisma.quiz.findMany({
      where: scope ? { trackName: scope } : undefined,
      orderBy: { updatedAt: "desc" },
      include: {
        questions: { orderBy: { order: "asc" }, select: { points: true } },
        _count: { select: { attempts: true } },
      },
    });

    return NextResponse.json({
      data: quizzes.map((quiz) => ({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        trackName: quiz.trackName,
        published: quiz.published,
        durationMinutes: quiz.durationMinutes,
        opensAt: quiz.opensAt?.toISOString() ?? null,
        closesAt: quiz.closesAt?.toISOString() ?? null,
        questionCount: quiz.questions.length,
        totalPoints: totalPoints(quiz.questions),
        attemptCount: quiz._count.attempts,
        createdAt: quiz.createdAt,
        updatedAt: quiz.updatedAt,
      })),
      scope: access.role === "manager" ? access.trackName : scope ?? null,
      role: access.role,
    });
  } catch (error) {
    console.error("Get Quizzes Error:", error);
    return NextResponse.json({ error: "Internal server error while loading quizzes." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const requestedTrack =
      typeof (body as Record<string, unknown>)?.trackName === "string"
        ? String((body as Record<string, unknown>).trackName).trim()
        : "";

    const trackName = access.role === "manager" ? access.trackName : requestedTrack;
    if (!trackName) {
      return NextResponse.json({ error: "Choose the learning track this quiz belongs to." }, { status: 400 });
    }

    const track = await prisma.learningTrack.findUnique({ where: { name: trackName } });
    if (!track) {
      return NextResponse.json({ error: "That learning track does not exist." }, { status: 400 });
    }

    const parsed = parseQuizInput(body);
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    // Reference PDFs are read once here and stored as text for grading.
    const questions = await resolveReferenceFiles(parsed.value.questions);

    const quiz = await prisma.quiz.create({
      data: {
        title: parsed.value.title,
        description: parsed.value.description,
        published: parsed.value.published,
        trackName: track.name,
        durationMinutes: parsed.value.durationMinutes,
        opensAt: parsed.value.opensAt,
        closesAt: parsed.value.closesAt,
        questions: { create: buildQuestionCreates(questions) },
      },
      include: { questions: { select: { id: true } } },
    });

    return NextResponse.json(
      {
        message: "Quiz created successfully",
        data: {
          id: quiz.id,
          ...parsed.value,
          questions: parsed.value.questions.map((question, index) => ({
            ...question,
            id: quiz.questions[index]?.id ?? question.id,
            referenceFilePages: questions[index]?.referenceFilePages ?? 0,
          })),
          trackName: track.name,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Create Quiz Error:", error);
    return NextResponse.json({ error: "Internal server error while creating the quiz." }, { status: 500 });
  }
}