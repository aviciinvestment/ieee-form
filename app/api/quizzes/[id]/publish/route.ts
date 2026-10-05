import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getManagerAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

/**
 * Approves an attempt. Until this runs the participant sees only "awaiting review", so this
 * endpoint is the single gate that reveals scores. The manager may override the AI suggested
 * score before publishing.
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
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
    const raw = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

    const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }
    if (access.role === "manager" && quiz.trackName !== access.trackName) {
      return NextResponse.json(
        { error: "You can only publish results for quizzes in your own track." },
        { status: 403 }
      );
    }

    const attempt = await prisma.quizAttempt.findUnique({
      where: { id: String(raw.attemptId ?? "") },
      include: { answers: true },
    });
    if (!attempt || attempt.quizId !== quiz.id) {
      return NextResponse.json({ error: "Attempt not found for this quiz." }, { status: 404 });
    }

    const feedback = typeof raw.feedback === "string" ? raw.feedback.trim().slice(0, 2000) : "";

    // Optional manual override of the AI suggested total.
    let adjustedScore: number | null = attempt.adjustedScore;
    let adjustedMaxScore: number | null = attempt.adjustedMaxScore;

    const rawScore = raw.adjustedScore;
    if (rawScore !== undefined && rawScore !== null && rawScore !== "") {
      const score = Number(rawScore);
      if (!Number.isFinite(score) || score < 0 || score > attempt.maxScore) {
        return NextResponse.json(
          { error: `Score must be a number between 0 and ${attempt.maxScore}.` },
          { status: 400 }
        );
      }
      adjustedScore = score;

      const rawMax = raw.adjustedMaxScore;
      if (rawMax !== undefined && rawMax !== null && rawMax !== "") {
        const max = Number(rawMax);
        if (!Number.isFinite(max) || max <= 0) {
          return NextResponse.json({ error: "Maximum score must be a positive number." }, { status: 400 });
        }
        adjustedMaxScore = max;
      } else {
        adjustedMaxScore = attempt.maxScore;
      }
    } else {
      adjustedScore = null;
      adjustedMaxScore = null;
    }

    const published = await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: {
        resultStatus: "PUBLISHED",
        publishedAt: attempt.publishedAt ?? new Date(),
        publishedBy: access.email,
        adjustedScore,
        adjustedMaxScore,
        adjustedFeedback: feedback,
      },
    });

    return NextResponse.json({
      message: `Result published for ${published.participantEmail}.`,
      data: {
        attemptId: published.id,
        resultStatus: published.resultStatus,
        publishedAt: published.publishedAt,
        publishedBy: published.publishedBy,
        score: published.adjustedScore ?? published.score,
        maxScore: published.adjustedMaxScore ?? published.maxScore,
      },
    });
  } catch (error) {
    console.error("Publish Attempt Error:", error);
    return NextResponse.json({ error: "Internal server error while publishing the result." }, { status: 500 });
  }
}

/** Withdraws a published result so the participant goes back to awaiting review. */
export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    let attemptId = "";
    try {
      const body = (await req.json()) as Record<string, unknown>;
      attemptId = typeof body?.attemptId === "string" ? body.attemptId : "";
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const attempt = await prisma.quizAttempt.findUnique({ where: { id: attemptId } });
    if (!attempt || attempt.quizId !== params.id) {
      return NextResponse.json({ error: "Attempt not found for this quiz." }, { status: 404 });
    }

    const quiz = await prisma.quiz.findUnique({ where: { id: params.id } });
    if (!quiz) {
      return NextResponse.json({ error: "Quiz not found." }, { status: 404 });
    }
    if (access.role === "manager" && quiz.trackName !== access.trackName) {
      return NextResponse.json(
        { error: "You can only change results for quizzes in your own track." },
        { status: 403 }
      );
    }

    const updated = await prisma.quizAttempt.update({
      where: { id: attempt.id },
      data: { resultStatus: "PENDING_REVIEW", publishedAt: null, publishedBy: null },
    });

    return NextResponse.json({
      message: "Result withdrawn. The participant is back to awaiting review.",
      data: { attemptId: updated.id, resultStatus: updated.resultStatus },
    });
  } catch (error) {
    console.error("Withdraw Attempt Error:", error);
    return NextResponse.json({ error: "Internal server error while withdrawing the result." }, { status: 500 });
  }
}