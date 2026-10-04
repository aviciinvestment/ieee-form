/**
 * Time limit arithmetic for quiz attempts. Pure and dependency free on purpose: the same
 * numbers decide what the countdown shows in the browser and what the submit endpoint accepts,
 * and this way both sides can be reasoned about (and tested) without a database.
 */

/**
 * Slack allowed on top of the time limit before a submission is refused. It absorbs clock skew
 * between the browser and the server plus the round trip of a large PDF upload, so an honest
 * participant who submits as the timer hits zero is never penalised.
 */
export const SUBMIT_GRACE_SECONDS = 120;

/** When a timed attempt must be finished, or null when the quiz has no time limit. */
export function attemptDeadline(startedAt: Date, durationMinutes: number): Date | null {
  if (!Number.isFinite(durationMinutes) || durationMinutes <= 0) return null;
  return new Date(startedAt.getTime() + durationMinutes * 60_000);
}

/** Whole seconds left on the clock, never negative. 0 means the timer has run out. */
export function remainingSeconds(startedAt: Date, durationMinutes: number, now = new Date()): number {
  const deadline = attemptDeadline(startedAt, durationMinutes);
  if (!deadline) return 0;
  return Math.max(0, Math.ceil((deadline.getTime() - now.getTime()) / 1000));
}

/**
 * True once the timer itself has run out, whatever the grace window. Uses `>=` so the server
 * agrees with the browser: `remainingSeconds` reaches 0 at exactly the deadline, so the deadline
 * itself already counts as up.
 */
export function isTimeUp(startedAt: Date, durationMinutes: number, now = new Date()): boolean {
  const deadline = attemptDeadline(startedAt, durationMinutes);
  if (!deadline) return false;
  return now.getTime() >= deadline.getTime();
}

/**
 * True when a submission arrives too late to be trusted. The browser submits automatically when
 * the countdown reaches zero, so only a client that sat on the answers well past the deadline
 * lands here, and its answers are discarded.
 */
export function isSubmissionLate(startedAt: Date, durationMinutes: number, now = new Date()): boolean {
  const deadline = attemptDeadline(startedAt, durationMinutes);
  if (!deadline) return false;
  return now.getTime() > deadline.getTime() + SUBMIT_GRACE_SECONDS * 1000;
}
