import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getParticipantAccess } from "@/lib/auth";
import { normalizeSubmission, participantResult } from "@/lib/quiz";
import { extractPdfTextFromCloudinary, PdfError, sanitizeExtractedText } from "@/lib/pdf";
import { isManagedPdfUrl } from "@/lib/cloudinary";
import { closeAttempt } from "@/lib/attempts";
import { isSubmissionLate } from "@/lib/quiz-timer";

export const dynamic = "force-dynamic";

// AI grading calls can take a while, especially when several long answers are graded.
export const maxDuration = 120;

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

    const existing = await prisma.quizAttempt.findUnique({
      where: { quizId_participantEmail: { quizId: quiz.id, participantEmail: access.registration.email } },
      include: { answers: true },
    });

    // The attempt is opened when the quiz is loaded, so a submit without one means the request
    // never came from the quiz page.
    if (!existing) {
      return NextResponse.json({ error: "Open the quiz before submitting your answers." }, { status: 409 });
    }
    if (existing.submittedAt) {
      const closed = { ...existing, submittedAt: existing.submittedAt };
      return NextResponse.json(
        { error: "You have already taken this quiz.", result: participantResult(closed, quiz.questions) },
        { status: 409 }
      );
    }

    // A submission that lands well past the deadline is discarded: the timer already ran out, so
    // anything held back is refused and the attempt closes exactly as the countdown left it.
    const late = isSubmissionLate(existing.startedAt, quiz.durationMinutes);
    const answerFiles = late ? undefined : await readUploadedAnswerFiles(quiz.questions, body);
    const attempt = await closeAttempt({
      attemptId: existing.id,
      questions: quiz.questions,
      body: late ? { answers: [] } : body,
      answerFiles,
    });

    if (!attempt) {
      // A concurrent request closed the attempt first, so this one no longer counts.
      const winner = await prisma.quizAttempt.findUnique({
        where: { quizId_participantEmail: { quizId: quiz.id, participantEmail: access.registration.email } },
        include: { answers: true },
      });
      return NextResponse.json(
        {
          error: "You have already taken this quiz.",
          result:
            winner?.submittedAt != null
              ? participantResult({ ...winner, submittedAt: winner.submittedAt }, quiz.questions)
              : undefined,
        },
        { status: 409 }
      );
    }

    if (late) {
      return NextResponse.json(
        {
          error: "Time is up for this quiz, so answers sent after the deadline were not graded.",
          result: participantResult(attempt, quiz.questions),
        },
        { status: 409 }
      );
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
