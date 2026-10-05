import { gradeWrittenAnswer, isAiGradingEnabled } from "@/lib/nvidia";
import { MAX_QUIZ_DURATION_MINUTES } from "@/lib/types";
import { parseWindowBound, validateWindowOrder } from "@/lib/quiz-window";

export const QUESTION_TYPES = ["OBJECTIVE", "SHORT_TEXT", "LONG_TEXT"] as const;
export type QuestionTypeValue = (typeof QUESTION_TYPES)[number];

export const MAX_QUESTIONS = 50;
export const MAX_OPTIONS = 8;
export const MAX_RESPONSE_LENGTH = 4000;

export const GRADING_METHODS = ["RULES", "EMBEDDING", "AI"] as const;
export type GradingMethodName = (typeof GRADING_METHODS)[number];

export const RESULT_STATUSES = ["PENDING_REVIEW", "PUBLISHED"] as const;
export type ResultStatusName = (typeof RESULT_STATUSES)[number];

export type QuizOptionInput = {
  id?: string;
  label: string;
  isCorrect: boolean;
};

export type QuestionInput = {
  id?: string;
  prompt: string;
  type: QuestionTypeValue;
  points: number;
  explanation: string;
  options: QuizOptionInput[];
  /** Cloudinary link to a manager supplied reference PDF for this question. */
  referenceFileUrl?: string;
  /** Text extracted from that PDF when the quiz is saved. */
  referenceFileText?: string;
  /** Pages of that PDF the AI will analyse. */
  referenceFilePages?: number;
};

export type QuizInput = {
  title: string;
  description: string;
  published: boolean;
  /** Time limit for one attempt in minutes; 0 means unlimited. */
  durationMinutes: number;
  /** Availability window bounds; null means the quiz is not bounded on that side. */
  opensAt: Date | null;
  closesAt: Date | null;
  questions: QuestionInput[];
};

export type GradedAnswer = {
  questionId: string;
  prompt: string;
  type: QuestionTypeValue;
  points: number;
  isCorrect: boolean;
  pointsAwarded: number;
  responseText: string;
  selectedOptionId: string | null;
  correctLabels: string[];
  expectedAnswers: string[];
  explanation: string;
  gradedBy: GradingMethodName;
  similarity: number | null;
  aiScore: number | null;
  aiReason: string;
  aiModel: string;
};

function asString(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/**
 * Time limit for a single attempt, in minutes. Anything missing, zero, negative or
 * non-numeric means "unlimited", and the value is capped so a quiz cannot be given
 * an absurd limit by accident.
 */
export function normalizeDurationMinutes(value: unknown): number {
  const minutes = Math.trunc(Number(value));
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return Math.min(minutes, MAX_QUIZ_DURATION_MINUTES);
}

/**
 * Reads the availability window out of a payload. Both bounds are optional, but a window that
 * closes before it opens is rejected here rather than quietly stored as a quiz nobody can open.
 */
export function parseQuizWindow(body: Record<string, unknown>): {
  ok: true;
  value: { opensAt: Date | null; closesAt: Date | null };
} | { ok: false; error: string } {
  const opensAt = parseWindowBound(body.opensAt);
  const closesAt = parseWindowBound(body.closesAt);

  const orderError = validateWindowOrder(opensAt, closesAt);
  if (orderError) return { ok: false, error: orderError };

  return { ok: true, value: { opensAt, closesAt } };
}

export function normalizeQuestionType(value: unknown): QuestionTypeValue {
  const raw = typeof value === "string" ? value.trim().toUpperCase() : "";
  return (QUESTION_TYPES as readonly string[]).includes(raw) ? (raw as QuestionTypeValue) : "OBJECTIVE";
}

/**
 * Text used to compare a participant's subjective answer against the answers set by
 * the manager. Lowercased, punctuation stripped and whitespace collapsed so that
 * "A List." still matches "a list".
 */
export function normalizeAnswerText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Subjective answers support comma separated keywords. "list, array" is treated as
 * "every one of these words must appear", while a plain answer must match exactly.
 */
export function splitKeywords(value: string): string[] {
  return value
    .split(/[,\n]/)
    .map((part) => normalizeAnswerText(part))
    .filter(Boolean);
}

export function matchesExpectedAnswer(response: string, expected: string): boolean {
  const normalizedResponse = normalizeAnswerText(response);
  if (!normalizedResponse) return false;

  const normalizedExpected = normalizeAnswerText(expected);
  if (!normalizedExpected) return false;
  if (normalizedResponse === normalizedExpected) return true;

  const keywords = splitKeywords(expected);
  if (keywords.length < 2) return false;
  return keywords.every((keyword) => normalizedResponse.includes(keyword));
}

export function parseQuizInput(
  body: unknown
): { ok: true; value: QuizInput } | { ok: false; error: string } {
  if (typeof body !== "object" || body === null) {
    return { ok: false, error: "Invalid JSON body." };
  }

  const raw = body as Record<string, unknown>;
  const title = asString(raw.title, 160);
  if (!title) return { ok: false, error: "Quiz title is required." };

  const description = asString(raw.description, 2000);
  const published = raw.published === true;
  const durationMinutes = normalizeDurationMinutes(raw.durationMinutes);

  const window = parseQuizWindow(raw);
  if (!window.ok) {
    return { ok: false, error: window.error };
  }
  const { opensAt, closesAt } = window.value;

  const rawQuestions = Array.isArray(raw.questions) ? raw.questions : [];
  if (rawQuestions.length === 0) {
    return { ok: false, error: "Add at least one question before saving the quiz." };
  }
  if (rawQuestions.length > MAX_QUESTIONS) {
    return { ok: false, error: `A quiz can hold at most ${MAX_QUESTIONS} questions.` };
  }

  const questions: QuestionInput[] = [];

  for (const entry of rawQuestions) {
    if (typeof entry !== "object" || entry === null) {
      return { ok: false, error: "Each question must be an object." };
    }

    const item = entry as Record<string, unknown>;
    const prompt = asString(item.prompt, 2000);
    if (!prompt) return { ok: false, error: "Every question needs a prompt." };

    const type = normalizeQuestionType(item.type);
    const rawPoints = Number(item.points);
    const points = Number.isFinite(rawPoints) ? Math.min(Math.max(Math.trunc(rawPoints), 1), 100) : 1;
    const explanation = asString(item.explanation, 2000);

    const rawOptions = Array.isArray(item.options) ? item.options : [];
    const options: QuizOptionInput[] = [];

    for (const optionEntry of rawOptions) {
      if (typeof optionEntry !== "object" || optionEntry === null) continue;
      const optionItem = optionEntry as Record<string, unknown>;
      const label = asString(optionItem.label, 500);
      if (!label) continue;
      options.push({
        id: typeof optionItem.id === "string" && optionItem.id ? optionItem.id : undefined,
        label,
        isCorrect: optionItem.isCorrect === true,
      });
      if (options.length >= MAX_OPTIONS) break;
    }

    if (type === "OBJECTIVE") {
      if (options.length < 2) {
        return { ok: false, error: "Objective questions need at least two answer choices." };
      }
      const correctCount = options.filter((option) => option.isCorrect).length;
      if (correctCount !== 1) {
        return { ok: false, error: "Objective questions need exactly one answer marked as correct." };
      }
    } else {
      if (options.length === 0) {
        return { ok: false, error: "Subjective questions need at least one expected answer from the manager." };
      }
      if (!options.some((option) => option.isCorrect)) {
        return { ok: false, error: "Subjective questions need at least one answer marked as accepted." };
      }
    }

    questions.push({
      id: typeof item.id === "string" && item.id ? item.id : undefined,
      prompt,
      type,
      points,
      explanation,
      options,
      referenceFileUrl: asString(item.referenceFileUrl, 500),
      referenceFileText: asString(item.referenceFileText, 60_000),
      referenceFilePages: Math.max(0, Math.trunc(Number(item.referenceFilePages) || 0)),
    });
  }

  return { ok: true, value: { title, description, published, durationMinutes, opensAt, closesAt, questions } };
}

export function totalPoints(questions: { points: number }[]): number {
  return questions.reduce((sum, question) => sum + question.points, 0);
}

export function buildOptionCreates(options: QuizOptionInput[]) {
  return options.map((option, index) => ({
    label: option.label,
    isCorrect: option.isCorrect,
    order: index + 1,
  }));
}

export function buildQuestionCreates(
  questions: (QuestionInput & { referenceFileText?: string; referenceFilePages?: number })[]
) {
  return questions.map((question, index) => ({
    prompt: question.prompt,
    type: question.type,
    points: question.points,
    explanation: question.explanation,
    order: index + 1,
    referenceFileUrl: question.referenceFileUrl ?? "",
    referenceFilePages: question.referenceFilePages ?? 0,
    referenceFileText: question.referenceFileText ?? "",
    options: { create: buildOptionCreates(question.options) },
  }));
}

export type AttemptAnswerView = {
  questionId: string;
  prompt: string;
  type: string;
  points: number;
  isCorrect: boolean;
  pointsAwarded: number;
  responseText: string;
  responseFileUrl: string;
  responseFilePages: number;
  referenceFileUrl: string;
  correctLabels: string[];
  expectedAnswers: string[];
  explanation: string;
  gradedBy: GradingMethodName;
  similarity: number | null;
  aiScore: number | null;
  aiReason: string;
};

export type AttemptResult = {
  attemptId: string;
  submittedAt: string;
  score: number;
  maxScore: number;
  percentage: number;
  resultStatus: ResultStatusName;
  publishedAt: string | null;
  answers: AttemptAnswerView[];
};

export type QuestionRecord = {
  id: string;
  prompt: string;
  type: QuestionTypeValue;
  points: number;
  explanation: string;
  referenceFileUrl: string;
  /** Text extracted from the manager's reference PDF; used as extra grading context. */
  referenceFileText: string;
  options: { id: string; label: string; isCorrect: boolean }[];
};

export type GradedAnswerRow = {
  questionId: string;
  selectedOptionId: string | null;
  responseText: string;
  responseFileUrl: string;
  responseFilePages: number;
  isCorrect: boolean;
  pointsAwarded: number;
  gradedBy: GradingMethodName;
  similarity: number | null;
  aiScore: number | null;
  aiReason: string;
  aiModel: string;
};

export type AttemptRecord = {
  id: string;
  submittedAt: Date;
  score: number;
  maxScore: number;
  percentage: number;
  resultStatus: ResultStatusName;
  publishedAt: Date | null;
  adjustedScore: number | null;
  adjustedMaxScore: number | null;
  adjustedFeedback: string;
  answers: GradedAnswerRow[];
};

/** The score a manager publishes: their manual adjustment wins when present. */
export function finalScore(attempt: {
  score: number;
  adjustedScore: number | null;
  adjustedMaxScore?: number | null;
}): { score: number; maxScore: number | null; percentage: number | null } {
  if (attempt.adjustedScore === null) {
    return { score: attempt.score, maxScore: null, percentage: null };
  }
  return { score: attempt.adjustedScore, maxScore: attempt.adjustedMaxScore ?? null, percentage: null };
}

/** Shapes an attempt plus the current quiz questions into the payload the participant sees. */
/**
 * A participant only ever sees the detailed result once a manager has published it. Until
 * then the attempt still exists, but it carries no score, no answers and no AI verdicts.
 */
export function participantResult(attempt: AttemptRecord, questions: QuestionRecord[]): AttemptResult {
  if (attempt.resultStatus !== "PUBLISHED") {
    return buildPendingResult({ id: attempt.id, submittedAt: attempt.submittedAt });
  }
  return buildAttemptResult(attempt, questions);
}

export function buildAttemptResult(attempt: AttemptRecord, questions: QuestionRecord[]): AttemptResult {
  const answersByQuestion = new Map(attempt.answers.map((answer) => [answer.questionId, answer]));
  const adjusted = finalScore(attempt);
  const maxScore = adjusted.maxScore ?? attempt.maxScore;

  return {
    attemptId: attempt.id,
    submittedAt: attempt.submittedAt.toISOString(),
    score: adjusted.score,
    maxScore,
    percentage: maxScore > 0 ? percentage(adjusted.score, maxScore) : attempt.percentage,
    resultStatus: attempt.resultStatus,
    publishedAt: attempt.publishedAt ? attempt.publishedAt.toISOString() : null,
    answers: questions.map((question) => {
      const answer = answersByQuestion.get(question.id);
      const expected = question.options.filter((option) => option.isCorrect).map((option) => option.label);
      return {
        questionId: question.id,
        prompt: question.prompt,
        type: question.type,
        points: question.points,
        isCorrect: answer?.isCorrect ?? false,
        pointsAwarded: answer?.pointsAwarded ?? 0,
        responseText: answer?.responseText ?? "",
        responseFileUrl: answer?.responseFileUrl ?? "",
        responseFilePages: answer?.responseFilePages ?? 0,
        referenceFileUrl: question.referenceFileUrl,
        correctLabels: expected,
        expectedAnswers: expected,
        explanation: question.explanation,
        gradedBy: answer?.gradedBy ?? "RULES",
        similarity: answer?.similarity ?? null,
        aiScore: answer?.aiScore ?? null,
        aiReason: answer?.aiReason ?? "",
      };
    }),
  };
}

/**
 * Hides the result until a manager publishes it. The participant is only told that their
 * attempt is being reviewed; no score, no answer key and no AI reasoning is exposed.
 */
export function buildPendingResult(attempt: {
  id: string;
  submittedAt: Date;
}): AttemptResult {
  return {
    attemptId: attempt.id,
    submittedAt: attempt.submittedAt.toISOString(),
    score: 0,
    maxScore: 0,
    percentage: 0,
    resultStatus: "PENDING_REVIEW",
    publishedAt: null,
    answers: [],
  };
}

export type Submission = {
  answers: {
    questionId: string;
    selectedOptionId: string | null;
    responseText: string;
    /** Cloudinary link to the PDF the participant uploaded as the answer. */
    responseFileUrl: string;
    /** Text extracted from that PDF, supplied by the upload response. */
    responseFileText: string;
    /** Pages of that PDF the AI will analyse. */
    responseFilePages: number;
  }[];
};

/**
 * Keeps only well formed answer objects so a malformed or hostile payload can never
 * crash grading. Anything that is not an object with a question id is discarded.
 */
export function normalizeSubmission(body: unknown): Submission {
  const raw = typeof body === "object" && body !== null ? (body as Record<string, unknown>).answers : undefined;
  const entries = Array.isArray(raw) ? raw : [];

  const answers: Submission["answers"] = [];
  const seen = new Set<string>();

  for (const entry of entries) {
    if (typeof entry !== "object" || entry === null) continue;
    const item = entry as Record<string, unknown>;

    const questionId = typeof item.questionId === "string" ? item.questionId : "";
    if (!questionId || seen.has(questionId)) continue;
    seen.add(questionId);

    const selectedOptionId = typeof item.selectedOptionId === "string" && item.selectedOptionId ? item.selectedOptionId : null;
    answers.push({
      questionId,
      selectedOptionId,
      responseText: asString(item.responseText, MAX_RESPONSE_LENGTH),
      responseFileUrl: asString(item.responseFileUrl, 500),
      responseFileText: asString(item.responseFileText, 60_000),
      responseFilePages: Math.max(0, Math.trunc(Number(item.responseFilePages) || 0)),
    });
  }

  return { answers };
}

/**
 * Grades a submission. Objective questions are decided by the marked option. Both written
 * question types are graded by the chat model:
 *
 * - SHORT_TEXT is graded strictly against the manager's accepted answers (factually correct or
 *   not), because embedding similarity awarded far too much credit to inaccurate answers.
 * - LONG_TEXT also asks the model for a score and a written reason.
 *
 * An exact or keyword match is always full credit. If the AI call fails, times out or returns
 * unusable JSON, the deterministic exact/keyword comparison is the only fallback: the answer
 * either matches an accepted answer or it does not, so no score is invented and a submission is
 * never blocked by a third-party outage.
 */
export async function gradeSubmission(
  questions: QuestionRecord[],
  submission: Submission,
  options: {
    useAi?: boolean;
    /** Text extracted from PDFs the participant uploaded, keyed by question id. */
    answerFiles?: Map<string, { url: string; text: string; pages: number }>;
  } = {}
): Promise<{ score: number; maxScore: number; answers: GradedAnswerRow[] }> {
  const useAi = options.useAi ?? true;
  const answerFiles = options.answerFiles ?? new Map<string, { url: string; text: string; pages: number }>();
  const submitted = new Map(submission.answers.map((answer) => [answer.questionId, answer]));

  let score = 0;
  let maxScore = 0;

  const answers: GradedAnswerRow[] = [];

  for (const question of questions) {
    maxScore += question.points;

    const provided = submitted.get(question.id);
    const selectedOptionId = provided?.selectedOptionId ?? null;
    const typedResponse = (provided?.responseText ?? "").trim().slice(0, MAX_RESPONSE_LENGTH);
    const uploadedFile =
      answerFiles.get(question.id) ??
      (provided?.responseFileUrl
        ? {
            url: provided.responseFileUrl,
            text: provided.responseFileText?.trim() ?? "",
            pages: provided.responseFilePages ?? 0,
          }
        : null);

    const chosenOption = question.options.find((option) => option.id === selectedOptionId);
    // A PDF answer is analysed as the response; typed text is used when no PDF was uploaded.
    const writtenResponse = uploadedFile?.text.trim() || typedResponse;
    // Always keep a human readable response so managers and participants can read results back.
    const responseText = chosenOption?.label ?? writtenResponse;

    const referenceAnswers = question.options.filter((option) => option.isCorrect).map((option) => option.label);

    let isCorrect = false;
    let pointsAwarded = 0;
    let gradedBy: GradingMethodName = "RULES";
    let similarity: number | null = null;
    let aiScore: number | null = null;
    let aiReason = "";
    let aiModel = "";

    if (question.type === "OBJECTIVE") {
      isCorrect = Boolean(chosenOption?.isCorrect);
      pointsAwarded = isCorrect ? question.points : 0;
    } else if (writtenResponse) {
      const ruleMatch = referenceAnswers.some((expected) => matchesExpectedAnswer(writtenResponse, expected));

      if (ruleMatch) {
        // Exact or keyword match: full credit without spending an AI call.
        isCorrect = true;
        pointsAwarded = question.points;
        gradedBy = "RULES";
        aiReason = "Matched an accepted answer by exact comparison.";
      } else if (useAi && isAiGradingEnabled() && referenceAnswers.length > 0) {
        try {
          const verdict = await gradeWrittenAnswer({
            prompt: question.prompt,
            expectedAnswers: referenceAnswers,
            studentAnswer: writtenResponse,
            maxPoints: question.points,
            kind: question.type === "SHORT_TEXT" ? "SHORT_TEXT" : "LONG_TEXT",
            referenceContext: question.referenceFileText,
            answerFileText: uploadedFile?.text,
          });
          aiScore = round(verdict.fraction, 4);
          aiReason = verdict.reason;
          aiModel = verdict.model;
          gradedBy = "AI";

          isCorrect = verdict.fraction >= 1 - 1e-9;
          pointsAwarded = round(question.points * verdict.fraction, 2);
        } catch (error) {
          console.error("AI grading failed, falling back to exact comparison:", error);
          aiReason = "AI grading was unavailable, so the exact-match comparison was used instead.";
        }
      }

      // Without an AI verdict an answer is either an accepted answer or it is not.
      if (!aiModel) {
        isCorrect = ruleMatch;
        pointsAwarded = isCorrect ? question.points : 0;
        gradedBy = "RULES";
        if (uploadedFile && !ruleMatch) {
          aiReason = `The uploaded PDF${uploadedFile.pages > 1 ? ` (${uploadedFile.pages} pages)` : ""} did not match an accepted answer by exact comparison, and AI grading was unavailable.`;
        }
      }

      // A written question with no reference answer can never be marked correct.
      if (referenceAnswers.length === 0) {
        isCorrect = false;
        pointsAwarded = 0;
        gradedBy = "RULES";
      }
    }

    score += pointsAwarded;

    answers.push({
      questionId: question.id,
      selectedOptionId,
      responseText,
      responseFileUrl: uploadedFile?.url ?? "",
      responseFilePages: uploadedFile?.pages ?? provided?.responseFilePages ?? 0,
      isCorrect,
      pointsAwarded,
      gradedBy,
      similarity,
      aiScore,
      aiReason,
      aiModel,
    });
  }

  return { score: round(score, 2), maxScore, answers };
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

export function percentage(score: number, max: number): number {
  if (max <= 0) return 0;
  return Math.round((score / max) * 10000) / 100;
}