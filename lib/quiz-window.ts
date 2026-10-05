/**
 * Availability window for a quiz: the moment it opens for participants and the moment it stops
 * accepting new attempts.
 *
 * Pure and dependency free for the same reason as `lib/quiz-timer.ts`: the browser, the quiz list
 * and the endpoint that opens an attempt must all agree on when a quiz is open, and that is only
 * reviewable when the rule lives in one testable place.
 *
 * A missing bound means "no bound on that side". A quiz with neither bound is open for as long as
 * it stays published, which keeps every quiz created before this feature working unchanged.
 */

export type QuizWindow = {
  /** ISO timestamp, or null when the quiz is open from the moment it is published. */
  opensAt: string | null;
  /** ISO timestamp, or null when the quiz never stops accepting attempts. */
  closesAt: string | null;
};

/** How a quiz looks to a participant right now. */
export type QuizWindowState = "open" | "upcoming" | "closed";

/** Matches `YYYY-MM-DDTHH:mm` with an optional seconds part and no timezone designator. */
const NAIVE_DATE_TIME = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;

/**
 * Parses a window bound from an untrusted payload. Anything blank, unusable or out of range becomes
 * `null` so a bad value can never take the quiz list down.
 *
 * A value without a timezone designator is read as UTC rather than as the server's local time, so
 * the answer does not depend on where the code happens to be running. The browser always sends a
 * full ISO timestamp, which is already unambiguous.
 */
export function parseWindowBound(value: unknown): Date | null {
  if (value === null || value === undefined) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  const source = NAIVE_DATE_TIME.test(trimmed) ? `${trimmed.replace(" ", "T")}Z` : trimmed;
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/** Normalises a window bound straight to the ISO string the API speaks. */
export function normalizeWindowBound(value: unknown): string | null {
  return parseWindowBound(value)?.toISOString() ?? null;
}

/** Rejects a window that closes before it opens, which would make the quiz unopenable. */
export function validateWindowOrder(opensAt: Date | null, closesAt: Date | null): string | null {
  if (opensAt && closesAt && closesAt.getTime() <= opensAt.getTime()) {
    return "The closing time must be after the opening time.";
  }
  return null;
}

/** Whether new attempts are accepted right now. */
export function quizWindowState(window: QuizWindow, now: Date = new Date()): QuizWindowState {
  const opensAt = parseWindowBound(window.opensAt);
  const closesAt = parseWindowBound(window.closesAt);

  if (opensAt && now.getTime() < opensAt.getTime()) return "upcoming";
  if (closesAt && now.getTime() >= closesAt.getTime()) return "closed";
  return "open";
}

/** Formats a window bound for people, falling back to a dash when there is no bound. */
export function formatWindowBound(iso: string | null, fallback = "—"): string {
  const parsed = parseWindowBound(iso);
  if (!parsed) return fallback;
  return parsed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
}

/** One sentence describing the window, used as help text under the editor inputs. */
export function describeWindow(window: QuizWindow): string {
  const opensAt = parseWindowBound(window.opensAt);
  const closesAt = parseWindowBound(window.closesAt);

  if (!opensAt && !closesAt) {
    return "Open the whole time it stays published. Participants can start the quiz at any moment.";
  }
  if (opensAt && !closesAt) {
    return `Opens ${formatWindowBound(opensAt.toISOString())} and stays open until you unpublish it.`;
  }
  if (!opensAt && closesAt) {
    return `Open now, and stops accepting new attempts on ${formatWindowBound(closesAt.toISOString())}.`;
  }
  return `Open from ${formatWindowBound(opensAt!.toISOString())} until ${formatWindowBound(
    closesAt!.toISOString()
  )}.`;
}

/**
 * Checks a window for a participant about to start an attempt. `ok: false` carries a sentence that
 * is safe to show verbatim, including the dates, so the endpoint never has to build its own copy.
 */
export function checkCanStartAttempt(
  window: QuizWindow,
  now: Date = new Date()
): { ok: true } | { ok: false; reason: string } {
  const state = quizWindowState(window, now);
  if (state === "upcoming") {
    return {
      ok: false,
      reason: `This quiz has not opened yet. It becomes available on ${formatWindowBound(window.opensAt)}.`,
    };
  }
  if (state === "closed") {
    return {
      ok: false,
      reason: `This quiz closed on ${formatWindowBound(window.closesAt)} and is no longer accepting attempts.`,
    };
  }
  return { ok: true };
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/**
 * Renders an ISO timestamp as the `YYYY-MM-DDTHH:mm` shape a `datetime-local` input expects, in
 * the reader's own timezone so the value they see is the value they picked.
 */
export function toDateTimeLocalValue(iso: string | null): string {
  const parsed = parseWindowBound(iso);
  if (!parsed) return "";
  return (
    `${parsed.getFullYear()}-${pad(parsed.getMonth() + 1)}-${pad(parsed.getDate())}` +
    `T${pad(parsed.getHours())}:${pad(parsed.getMinutes())}`
  );
}

/**
 * Turns a `datetime-local` input value back into an ISO timestamp. The input has no timezone, so
 * the browser reads it as the reader's local time and converts to UTC for us. An empty or broken
 * value clears the bound.
 */
export function fromDateTimeLocalValue(value: string): string | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}
