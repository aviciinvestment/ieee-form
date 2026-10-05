import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getParticipantAccess } from "@/lib/auth";
import { totalPoints } from "@/lib/quiz";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const access = await getParticipantAccess(req);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const quizzes = await prisma.quiz.findMany({
      where: { trackName: access.registration.techSkill, published: true },
      orderBy: { createdAt: "desc" },
      include: {
        questions: { orderBy: { order: "asc" }, select: { points: true, type: true } },
        attempts: {
          where: { participantEmail: access.registration.email, submittedAt: { not: null } },
          select: {
            id: true,
            score: true,
            maxScore: true,
            percentage: true,
            submittedAt: true,
            resultStatus: true,
            publishedAt: true,
            adjustedScore: true,
            adjustedMaxScore: true,
          },
        },
      },
    });

    return NextResponse.json({
      data: {
        participant: {
          firstName: access.registration.firstName,
          lastName: access.registration.lastName,
          email: access.registration.email,
          trackName: access.registration.techSkill,
        },
        quizzes: quizzes.map((quiz) => ({
          id: quiz.id,
          title: quiz.title,
          description: quiz.description,
          trackName: quiz.trackName,
          durationMinutes: quiz.durationMinutes,
          // Quizzes outside their availability window are still listed so a participant can see
          // when a quiz opens, or that it has already closed.
          opensAt: quiz.opensAt?.toISOString() ?? null,
          closesAt: quiz.closesAt?.toISOString() ?? null,
          questionCount: quiz.questions.length,
          totalPoints: totalPoints(quiz.questions),
          objectiveCount: quiz.questions.filter((question) => question.type === "OBJECTIVE").length,
          subjectiveCount: quiz.questions.filter((question) => question.type !== "OBJECTIVE").length,
          createdAt: quiz.createdAt,
          // The score is only included once a manager has published the result.
          attempt: quiz.attempts[0]
            ? {
                id: quiz.attempts[0].id,
                submittedAt: quiz.attempts[0].submittedAt?.toISOString() ?? "",
                resultStatus: quiz.attempts[0].resultStatus,
                publishedAt: quiz.attempts[0].publishedAt?.toISOString() ?? null,
                ...(quiz.attempts[0].resultStatus === "PUBLISHED"
                  ? {
                      score: quiz.attempts[0].adjustedScore ?? quiz.attempts[0].score,
                      maxScore: quiz.attempts[0].adjustedMaxScore ?? quiz.attempts[0].maxScore,
                      percentage:
                        quiz.attempts[0].adjustedScore !== null &&
                        (quiz.attempts[0].adjustedMaxScore ?? quiz.attempts[0].maxScore) > 0
                          ? Math.round(
                              (quiz.attempts[0].adjustedScore /
                                (quiz.attempts[0].adjustedMaxScore ?? quiz.attempts[0].maxScore)) *
                                10000
                            ) / 100
                          : quiz.attempts[0].percentage,
                    }
                  : { score: null, maxScore: null, percentage: null }),
              }
            : null,
        })),
      },
    });
  } catch (error) {
    console.error("Get Available Quizzes Error:", error);
    return NextResponse.json({ error: "Internal server error while loading quizzes." }, { status: 500 });
  }
}