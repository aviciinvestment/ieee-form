import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getParticipantAccess } from "@/lib/auth";
import { gradeSubmission, normalizeSubmission, participantResult, percentage, totalPoints } from "@/lib/quiz";
import { extractPdfTextFromCloudinary, PdfError, sanitizeExtractedText } from "@/lib/pdf";
import { isManagedPdfUrl } from "@/lib/cloudinary";

export const dynamic = "force-dynamic";

// AI grading calls can take a while, especially when several long answers are graded.
export const maxDuration = 120;

type AttemptWithAnswers = Prisma.QuizAttemptGetPayload<{ include: { answers: true } }>;

/**
 * Picks the text the AI will grade for every PDF answer. The text extracted during the upload is
 * used when the client sends it; otherwise we try to read the document from Cloudinary ourselves,
 * which is the only option on accounts that do not allow public delivery.
 */
async function readUploadedAnswerFiles(
  questions: { id: string }[],
  body: unknown
): Promise<Map<string, { url: string; text: string; pages: number }>> {
  const submission = normalizeSubmission(body);
  const files = new Map<string, { url: string; text: string; pages: number }>();
  const knownQuestionIds = new Set(questions.map((question) => question.id));

  for (const answer of submission.answers) {
    if (!answer.responseFileUrl || !knownQuestionIds.has(answer.questionId)) continue;
    if (!isManagedPdfUrl(answer.responseFileUrl)) continue;

    const supplied = sanitizeExtractedText(answer.responseFileText);
    if (supplied) {
      files.set(answer.questionId, {
        url: answer.responseFileUrl,
        text: supplied,
        pages: answer.responseFilePages,
      });
      continue;
    }

    try {
      const extracted = await extractPdfTextFromCloudinary(answer.responseFileUrl);
      files.set(answer.questionId, {
        url: answer.responseFileUrl,
        text: extracted.text,
        pages: extracted.pages.length,
      });
    } catch (error) {
      if (error instanceof PdfError) continue; // Unreadable document: the answer is graded as blank.
      console.error("Could not read an uploaded answer PDF:", error);
    }
  }

  return files;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getParticipantAccess(req);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const quiz = await prisma.quiz.findUnique({
      where: { id: params.id },
      include: {
        questions: { orderBy: { order: "asc" }, include: { options: { orderBy: { order: "asc" } } } },
      },
    });

    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }
    if (!quiz.published) {
      return NextResponse.json({ error: "This quiz has not been published yet." }, { status: 403 });
    }
    if (quiz.trackName !== access.registration.techSkill) {
      return NextResponse.json({ error: "This quiz belongs to a different learning track." }, { status: 403 });
    }
    if (quiz.questions.length === 0) {
      return NextResponse.json({ error: "This quiz has no questions yet." }, { status: 409 });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const max = totalPoints(quiz.questions);
    const answerFiles = await readUploadedAnswerFiles(quiz.questions, body);
    const graded = await gradeSubmission(quiz.questions, normalizeSubmission(body), { answerFiles });
    const resultPercentage = percentage(graded.score, max);

    const existing = await prisma.quizAttempt.findUnique({
      where: { quizId_participantEmail: { quizId: quiz.id, participantEmail: access.registration.email } },
      include: { answers: true },
    });

    if (existing) {
      return NextResponse.json(
        { error: "You have already taken this quiz.", result: participantResult(existing, quiz.questions) },
        { status: 409 }
      );
    }

    let attempt: AttemptWithAnswers;
    try {
      attempt = await prisma.quizAttempt.create({
        data: {
          quizId: quiz.id,
          registrationId: access.registration.id,
          participantEmail: access.registration.email,
          participantName: `${access.registration.firstName} ${access.registration.lastName}`.trim(),
          trackName: access.registration.techSkill,
          score: graded.score,
          maxScore: max,
          percentage: resultPercentage,
          // The participant cannot see anything until a manager publishes the result.
          resultStatus: "PENDING_REVIEW",
          answers: { create: graded.answers },
        },
        include: { answers: true },
      });
    } catch (error) {
      // The unique index on (quizId, participantEmail) is the real guard against a second attempt.
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const winner = await prisma.quizAttempt.findUnique({
          where: { quizId_participantEmail: { quizId: quiz.id, participantEmail: access.registration.email } },
          include: { answers: true },
        });
        if (winner) {
          return NextResponse.json(
            { error: "You have already taken this quiz.", result: participantResult(winner, quiz.questions) },
            { status: 409 }
          );
        }
      }
      throw error;
    }

    return NextResponse.json(
      {
        message: "Quiz submitted. Your result will appear here once the community manager reviews it.",
        result: participantResult(attempt, quiz.questions),
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Submit Quiz Error:", error);
    return NextResponse.json({ error: "Internal server error while submitting your answers." }, { status: 500 });
  }
}