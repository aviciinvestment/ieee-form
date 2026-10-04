import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getParticipantAccess } from "@/lib/auth";
import { buildAttemptResult, buildPendingResult, totalPoints } from "@/lib/quiz";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
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

    const quizSummary = {
      id: quiz.id,
      title: quiz.title,
      description: quiz.description,
      trackName: quiz.trackName,
      questionCount: quiz.questions.length,
      totalPoints: totalPoints(quiz.questions),
    };

    const attempt = await prisma.quizAttempt.findUnique({
      where: { quizId_participantEmail: { quizId: quiz.id, participantEmail: access.registration.email } },
      include: { answers: true },
    });

    if (attempt) {
      // Nothing about the result is revealed until a manager publishes it.
      const result =
        attempt.resultStatus === "PUBLISHED"
          ? buildAttemptResult(attempt, quiz.questions)
          : buildPendingResult({ id: attempt.id, submittedAt: attempt.submittedAt });
      return NextResponse.json({ data: { quiz: quizSummary, attempted: true, result } });
    }

    return NextResponse.json({
      data: {
        quiz: quizSummary,
        attempted: false,
        // Correct answers are intentionally omitted so they cannot leak before submission.
        questions: quiz.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          points: question.points,
          order: question.order,
          // Safe to show: it only tells the participant which document the question is about.
          referenceFileUrl: question.referenceFileUrl,
          referenceFilePages: question.referenceFilePages,
          options: question.options.map((option) => ({ id: option.id, label: option.label })),
        })),
      },
    });
  } catch (error) {
    console.error("Take Quiz Error:", error);
    return NextResponse.json({ error: "Internal server error while loading the quiz." }, { status: 500 });
  }
}