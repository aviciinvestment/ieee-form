import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getManagerAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getManagerAccess(req);
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
    if (access.role === "manager" && quiz.trackName !== access.trackName) {
      return NextResponse.json(
        { error: "You can only view attempts for quizzes in your own track." },
        { status: 403 }
      );
    }

    const attempts = await prisma.quizAttempt.findMany({
      where: { quizId: quiz.id },
      orderBy: { submittedAt: "desc" },
      include: { answers: true },
    });

    const answerByKey = new Map(
      attempts.flatMap((attempt) => attempt.answers.map((answer) => [`${attempt.id}:${answer.questionId}`, answer] as const))
    );

    return NextResponse.json({
      data: {
        quiz: {
          id: quiz.id,
          title: quiz.title,
          trackName: quiz.trackName,
          published: quiz.published,
          totalPoints: quiz.questions.reduce((sum, question) => sum + question.points, 0),
        },
        questions: quiz.questions.map((question, index) => ({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          points: question.points,
          order: index + 1,
          referenceFileUrl: question.referenceFileUrl,
          referenceFilePages: question.referenceFilePages,
          correctLabels: question.options.filter((option) => option.isCorrect).map((option) => option.label),
        })),
        attempts: attempts.map((attempt) => ({
          id: attempt.id,
          participantEmail: attempt.participantEmail,
          participantName: attempt.participantName,
          trackName: attempt.trackName,
          score: attempt.score,
          maxScore: attempt.maxScore,
          percentage: attempt.percentage,
          submittedAt: attempt.submittedAt,
          resultStatus: attempt.resultStatus,
          publishedAt: attempt.publishedAt,
          publishedBy: attempt.publishedBy,
          adjustedScore: attempt.adjustedScore,
          adjustedMaxScore: attempt.adjustedMaxScore,
          adjustedFeedback: attempt.adjustedFeedback,
          answers: quiz.questions.map((question) => {
            const answer = answerByKey.get(`${attempt.id}:${question.id}`);
            return {
              questionId: question.id,
              responseText: answer?.responseText ?? "",
              responseFileUrl: answer?.responseFileUrl ?? "",
              responseFilePages: answer?.responseFilePages ?? 0,
              selectedOptionId: answer?.selectedOptionId ?? null,
              isCorrect: answer?.isCorrect ?? false,
              pointsAwarded: answer?.pointsAwarded ?? 0,
              gradedBy: answer?.gradedBy ?? "RULES",
              similarity: answer?.similarity ?? null,
              aiScore: answer?.aiScore ?? null,
              aiReason: answer?.aiReason ?? "",
              aiModel: answer?.aiModel ?? "",
            };
          }),
        })),
      },
    });
  } catch (error) {
    console.error("Get Quiz Attempts Error:", error);
    return NextResponse.json({ error: "Internal server error while loading attempts." }, { status: 500 });
  }
}