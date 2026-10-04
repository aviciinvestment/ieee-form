const NVIDIA_BASE_URL = "https://integrate.api.nvidia.com/v1";

export const CHAT_MODEL = process.env.NVIDIA_CHAT_MODEL || "nvidia/nemotron-3-super-120b-a12b";

/** Grading calls are retried on transient network errors and rate limits. */
const MAX_ATTEMPTS = 3;
const RETRY_DELAYS_MS = [500, 1500];

/**
 * The key is read from the environment so it never ends up in the bundle or in git.
 * Only `NVIDIA_CHAT_KEY` is needed: grading is done by the chat model, which reads the
 * question and the manager's answers. Nothing is graded by embedding similarity any more.
 */
function apiKey(): string {
  const key = process.env.NVIDIA_CHAT_KEY;
  if (!key) {
    throw new Error("NVIDIA_CHAT_KEY is not configured. Add it to .env to enable AI grading.");
  }
  return key;
}

export function isAiGradingEnabled(): boolean {
  return Boolean(process.env.NVIDIA_CHAT_KEY);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

async function postJson(path: string, body: unknown, timeoutMs: number): Promise<unknown> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(`${NVIDIA_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          Authorization: `Bearer ${apiKey()}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      if (res.ok) {
        return text ? JSON.parse(text) : {};
      }

      // Rate limits and server-side hiccups are worth another attempt; bad requests are not.
      const retryable = res.status === 429 || res.status >= 500;
      lastError = new Error(`NVIDIA ${path} failed with ${res.status}: ${text.slice(0, 200)}`);
      if (!retryable || attempt === MAX_ATTEMPTS) throw lastError;
    } catch (error) {
      lastError = error;
      if (attempt === MAX_ATTEMPTS) throw lastError;
    } finally {
      clearTimeout(timer);
    }

    await sleep(RETRY_DELAYS_MS[Math.min(attempt - 1, RETRY_DELAYS_MS.length - 1)]);
  }

  throw lastError;
}

export type AnswerKind = "SHORT_TEXT" | "LONG_TEXT";

export type WrittenAnswerVerdict = {
  fraction: number;
  reason: string;
  model: string;
};

/**
 * Asks the chat model to grade a written answer against the reference answers the community
 * manager set for the question. The model replies with JSON only, and the response is parsed
 * defensively because reasoning models sometimes wrap it in prose or a fenced code block.
 *
 * Short answers are graded strictly: the model has to read the question, accept only factually
 * equivalent answers, and mark anything inaccurate or contradictory as (nearly) wrong. There is
 * no generous partial credit for "close enough" wording, which is what embedding similarity used
 * to award.
 */
export async function gradeWrittenAnswer(input: {
  prompt: string;
  expectedAnswers: string[];
  studentAnswer: string;
  maxPoints: number;
  kind: AnswerKind;
  /** Text extracted from the manager's reference PDF, used as extra grading context. */
  referenceContext?: string;
  /** Text extracted from the PDF the participant uploaded as the answer. */
  answerFileText?: string;
  timeoutMs?: number;
}): Promise<WrittenAnswerVerdict> {
  const reference = input.expectedAnswers
    .map((answer, index) => `${index + 1}. ${answer}`)
    .join("\n");
  const isShort = input.kind === "SHORT_TEXT";

  const systemPrompt = [
    "You grade a student's written answer for an online quiz.",
    "You are given the question, the reference answer(s) set by the community manager, and the student's answer.",
    isShort
      ? [
          "This is a SHORT answer question, so judge it strictly:",
          "Read the question carefully and decide whether the student's answer states the correct fact.",
          "Ignore differences in casing, punctuation, spacing and wording.",
          "Accept clearly equivalent wording, synonyms, abbreviations and correct alternative names.",
          "Score 1 only when the answer is factually correct and complete for the question asked.",
          "Score 0 if the answer is factually wrong, answers a different question, is empty or is nonsense.",
          "Use a score between 0 and 0.4 only when the student shows a real misunderstanding of the correct fact.",
          "Never reward an answer just because it is on the same topic: relevance is not correctness.",
          "If the answer contains any factual error, it must not score above 0.5.",
        ].join(" ")
      : [
          "This is a LONG answer question.",
          "Judge factual correctness, completeness, understanding and how well it covers what the question asked.",
          "Ignore spelling, grammar and formatting differences.",
          "Award proportional credit, and do not give credit for claims that are wrong or not supported.",
        ].join(" "),
    "Reply with JSON only, no extra text, in exactly this shape:",
    '{"score": <number between 0 and 1>, "reason": "<one or two sentences explaining the score>"}',
  ].join(" ");

  const userPrompt = [
    `Question: ${input.prompt}`,
    `Reference answer(s) from the manager:\n${reference}`,
    input.referenceContext?.trim()
      ? `Extra context the manager supplied in a reference document. Use it to judge the answer, but the reference answer(s) above stay the rubric:\n${input.referenceContext.trim()}`
      : "",
    input.answerFileText?.trim()
      ? `Student answer, extracted from the PDF the participant uploaded:\n${input.answerFileText.trim()}`
      : `Student answer: ${input.studentAnswer.trim()}`,
    `Maximum points available: ${input.maxPoints}`,
    "Return the JSON object now.",
  ]
    .filter(Boolean)
    .join("\n\n");

  const payload = (await postJson(
    "/chat/completions",
    {
      model: CHAT_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0,
      max_tokens: 2048,
    },
    input.timeoutMs ?? 45_000
  )) as { choices?: { message?: { content?: string } }[] };

  const content = payload?.choices?.[0]?.message?.content ?? "";
  const parsed = extractJson(content);

  if (!parsed) {
    throw new Error("Could not read a score from the AI grading response.");
  }

  const rawScore = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
  const fraction = Number.isFinite(rawScore) ? Math.max(0, Math.min(1, rawScore)) : 0;
  const reason = typeof parsed.reason === "string" ? parsed.reason.trim().slice(0, 2000) : "";

  return { fraction, reason, model: CHAT_MODEL };
}

/** Pulls the first JSON object out of raw model output, ignoring fences and prose. */
export function extractJson(content: string): { score?: number; reason?: string } | null {
  const text = content.trim();
  if (!text) return null;

  const candidates = [text];

  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced?.[1]) candidates.push(fenced[1].trim());

  const brace = text.match(/\{[\s\S]*\}/);
  if (brace?.[0]) candidates.push(brace[0]);

  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate);
      if (parsed && typeof parsed === "object") {
        return parsed as { score?: number; reason?: string };
      }
    } catch {
      /* try the next candidate */
    }
  }
  return null;
}