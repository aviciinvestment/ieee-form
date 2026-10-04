import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getParticipantAccess } from "@/lib/auth";
import { buildAttemptResult, buildPendingResult, totalPoints } from "@/lib/quiz";
import { closeAttempt } from "@/lib/attempts";
import { attemptDeadline, isTimeUp, remainingSeconds } from "@/lib/quiz-timer";

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
      durationMinutes: quiz.durationMinutes,
      questionCount: quiz.questions.length,
      totalPoints: totalPoints(quiz.questions),
    };

    const attemptWhere = {
      quizId_participantEmail: { quizId: quiz.id, participantEmail: access.registration.email },
    };

    let found = await prisma.quizAttempt.findUnique({ where: attemptWhere, include: { answers: true } });

    // The clock keeps running while the page is closed, so an attempt that ran out in the
    // meantime is closed here as a blank submission rather than left dangling.
    if (found && !found.submittedAt && isTimeUp(found.startedAt, quiz.durationMinutes)) {
      const expired = await closeAttempt({
        attemptId: found.id,
        questions: quiz.questions,
        body: { answers: [] },
        // Recorded as finishing at the deadline rather than now, so a late reload cannot look early.
        submittedAt: attemptDeadline(found.startedAt, quiz.durationMinutes) ?? new Date(),
      });
      if (expired) {
        return NextResponse.json({
          data: { quiz: quizSummary, attempted: true, result: buildPendingResult(expired), timedOut: true },
        });
      }
      // The submission that raced this check closed the attempt first, so report what it produced.
      found = await prisma.quizAttempt.findUnique({ where: attemptWhere, include: { answers: true } });
    }

    const submittedAt = found?.submittedAt;
    if (found && submittedAt) {
      // Nothing about the result is revealed until a manager publishes it.
      const closed = { ...found, submittedAt };
      const result =
        closed.resultStatus === "PUBLISHED"
          ? buildAttemptResult(closed, quiz.questions)
          : buildPendingResult(closed);
      return NextResponse.json({ data: { quiz: quizSummary, attempted: true, result } });
    }

    // Opening the quiz starts the clock. Reloading resumes with whatever time is left.
    let startedAt = found?.startedAt;
    if (!startedAt) {
      try {
        const opened = await prisma.quizAttempt.create({
          data: {
            quizId: quiz.id,
            registrationId: access.registration.id,
            participantEmail: access.registration.email,
            participantName: `${access.registration.firstName} ${access.registration.lastName}`.trim(),
            trackName: access.registration.techSkill,
          },
          select: { startedAt: true },
        });
        startedAt = opened.startedAt;
      } catch (error) {
        // Two tabs opened at once: the loser reuses the attempt that already exists.
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        const winner = await prisma.quizAttempt.findUnique({ where: attemptWhere, select: { startedAt: true } });
        if (!winner) throw error;
        startedAt = winner.startedAt;
      }
    }

    return NextResponse.json({
      data: {
        quiz: quizSummary,
        attempted: false,
        remainingSeconds: remainingSeconds(startedAt, quiz.durationMinutes),
        // Correct answers are intentionally omitted so they cannot leak before submission.
        questions: quiz.questions.map((question) => ({
          id: question.id,
          prompt: question.prompt,
          type: question.type,
          points: question.points,
          order: question.order,
          options: question.options.map((option) => ({ id: option.id, label: option.label })),
        })),
      },
    });
  } catch (error) {
    console.error("Take Quiz Error:", error);
    return NextResponse.json({ error: "Internal server error while loading the quiz." }, { status: 500 });
  }
}