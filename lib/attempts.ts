import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { gradeSubmission, normalizeSubmission, percentage, totalPoints, type QuestionRecord } from "@/lib/quiz";

/** An attempt that has been finished, so its submission time is always known. */
export type ClosedAttempt = Omit<
  Prisma.QuizAttemptGetPayload<{ include: { answers: true } }>,
  "submittedAt"
> & { submittedAt: Date };

/**
 * Grades the answers on the request and closes the open attempt for good. Closing is the only
 * way an attempt is ever finished, whether the participant pressed submit, the client auto
 * submitted at zero, or the timer expired while the page was closed.
 *
 * Returns null when another request closed the attempt first. Grading happens before the attempt
 * is claimed so a failed AI call leaves the attempt open and retryable, and the claim itself is
 * the atomic step that stops a submit racing a timeout check from overwriting each other.
 */
export async function closeAttempt(options: {
  attemptId: string;
  questions: QuestionRecord[];
  /** Raw submission body, graded by `gradeSubmission`. */
  body: unknown;
  /** Text extracted from PDFs the participant uploaded, keyed by question id. */
  answerFiles?: Map<string, { url: string; text: string; pages: number }>;
  submittedAt?: Date;
}): Promise<ClosedAttempt | null> {
  const max = totalPoints(options.questions);
  const graded = await gradeSubmission(options.questions, normalizeSubmission(options.body), {
    answerFiles: options.answerFiles,
  });

  const submittedAt = options.submittedAt ?? new Date();
  const claimed = await prisma.quizAttempt.updateMany({
    where: { id: options.attemptId, submittedAt: null },
    data: { submittedAt },
  });
  if (claimed.count === 0) return null;

  const attempt = await prisma.quizAttempt.update({
    where: { id: options.attemptId },
    data: {
      score: graded.score,
      maxScore: max,
      percentage: percentage(graded.score, max),
      answers: { deleteMany: {}, create: graded.answers },
    },
    include: { answers: true },
  });

  return { ...attempt, submittedAt };
}
