"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Award, Bot, CheckCircle2, CircleSlash, Clock, FileText, Loader2, Send, Upload, X } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { AuthSignIn } from "@/components/auth-sign-in";
import { QuizWindowBadge } from "@/components/quiz-window-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { formatDateTime } from "@/lib/format";
import { GRADING_METHOD_LABELS, type AttemptResultView, type TakeQuestion } from "@/lib/types";

const emailHeader = (email: string) => ({ "X-User-Email": email });

type UploadedPdf = { url: string; fileName: string; pages: number; characters: number; text: string };
type AnswerEntry = { selectedOptionId: string | null; responseText: string; file?: UploadedPdf };

type QuizSummaryView = {
  id: string;
  title: string;
  description: string;
  trackName: string;
  questionCount: number;
  totalPoints: number;
  /** Time limit for one attempt in minutes; 0 means unlimited. */
  durationMinutes: number;
  /** Availability window bounds as ISO strings; null means no bound on that side. */
  opensAt?: string | null;
  closesAt?: string | null;
};

type TakePayload = {
  quiz: QuizSummaryView;
  attempted: boolean;
  /** True when the attempt was closed because its time ran out before the page was reopened. */
  timedOut?: boolean;
  /** Whole seconds left on the clock when the page loaded, or 0 for an unlimited quiz. */
  remainingSeconds?: number;
  questions?: TakeQuestion[];
  result?: AttemptResultView;
};

/** Renders a countdown as mm:ss, growing the hours only when a quiz needs them. */
function formatCountdown(totalSeconds: number): string {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const clock = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  return hours > 0 ? `${hours}:${clock}` : clock;
}

export function QuizTaker({ quizId }: { quizId: string }) {
  const [email, setEmail] = useState<string | null>(null);
  const [payload, setPayload] = useState<TakePayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [answers, setAnswers] = useState<Record<string, AnswerEntry>>({});
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<AttemptResultView | null>(null);
  const [uploadingFor, setUploadingFor] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState("");
  const [maxPages, setMaxPages] = useState(0);
  /** null means the quiz has no time limit, so no countdown is shown. */
  const [remainingSeconds, setRemainingSeconds] = useState<number | null>(null);
  const fileInputs = useRef<Record<string, HTMLInputElement | null>>({});
  const submitRef = useRef<() => void>(() => {});
  const autoSubmitted = useRef(false);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(quizId)}/take`, { headers: emailHeader(email) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setPayload(null);
        setError(data.error || "Could not load this quiz.");
        return;
      }
      const next: TakePayload = data.data;
      setPayload(next);
      setResult(next.attempted ? (next.result ?? null) : null);
      autoSubmitted.current = false;
      if (!next.attempted && next.questions) {
        const initial: Record<string, AnswerEntry> = {};
        for (const question of next.questions) {
          initial[question.id] = { selectedOptionId: null, responseText: "" };
        }
        setAnswers(initial);
        setRemainingSeconds(next.quiz.durationMinutes > 0 ? (next.remainingSeconds ?? 0) : null);
      } else {
        setRemainingSeconds(null);
      }
    } catch {
      setError("Network error while loading this quiz.");
    } finally {
      setLoading(false);
    }
  }, [email, quizId]);

  useEffect(() => {
    void load();
  }, [load]);

  const timed = remainingSeconds !== null;

  useEffect(() => {
    if (!timed) return;
    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => (current === null ? current : Math.max(0, current - 1)));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [timed]);

  const questions = payload?.questions ?? [];
  const answeredCount = useMemo(
    () =>
      questions.filter((question) => {
        const entry = answers[question.id];
        if (!entry) return false;
        if (question.type === "OBJECTIVE") return Boolean(entry.selectedOptionId);
        return Boolean(entry.file) || entry.responseText.trim().length > 0;
      }).length,
    [questions, answers]
  );

  /** Uploads a PDF through the server so the API secret never reaches the browser. */
  async function uploadAnswerPdf(questionId: string, file: File) {
    setUploadingFor(questionId);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/api/uploads/pdf", { method: "POST", headers: emailHeader(email as string), body });
      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        data?: { url: string; fileName: string; pagesAnalysed: number; characters: number; maxPages: number; text: string };
      };
      if (!res.ok || !payload.data) throw new Error(payload.error ?? "Upload failed.");

      setMaxPages(payload.data.maxPages);
      setAnswers((prev) => ({
        ...prev,
        [questionId]: {
          selectedOptionId: prev[questionId]?.selectedOptionId ?? null,
          responseText: prev[questionId]?.responseText ?? "",
          file: {
            url: payload.data!.url,
            fileName: `${payload.data!.fileName}.pdf`,
            pages: payload.data!.pagesAnalysed,
            characters: payload.data!.characters,
            text: payload.data!.text,
          },
        },
      }));
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploadingFor(null);
      const input = fileInputs.current[questionId];
      if (input) input.value = "";
    }
  }

  function clearAnswerPdf(questionId: string) {
    setAnswers((prev) => {
      const entry = prev[questionId];
      if (!entry) return prev;
      const next = { selectedOptionId: entry.selectedOptionId, responseText: entry.responseText };
      return { ...prev, [questionId]: next };
    });
    const input = fileInputs.current[questionId];
    if (input) input.value = "";
  }

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(quizId)}/submit`, {
        method: "POST",
        headers: { ...emailHeader(email as string), "Content-Type": "application/json" },
        body: JSON.stringify({
          answers: questions.map((question) => ({
            questionId: question.id,
            selectedOptionId: answers[question.id]?.selectedOptionId ?? null,
            responseText: answers[question.id]?.responseText ?? "",
            responseFileUrl: answers[question.id]?.file?.url ?? "",
            responseFileText: answers[question.id]?.file?.text ?? "",
            responseFilePages: answers[question.id]?.file?.pages ?? 0,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not submit your answers.");
        if (data.result) setResult(data.result);
        return;
      }
      setResult(data.result);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Network error while submitting your answers.");
    } finally {
      setSubmitting(false);
    }
  }

  useEffect(() => {
    submitRef.current = submit;
  });

  // The server refuses answers that arrive long after the deadline, so the countdown has to hand
  // the answers over itself the moment it reaches zero.
  useEffect(() => {
    if (remainingSeconds !== 0 || autoSubmitted.current) return;
    autoSubmitted.current = true;
    submitRef.current();
  }, [remainingSeconds]);

  const expired = remainingSeconds === 0;

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-10">
      <div className="mb-6 text-center">
        <AppLogo size={56} />
      </div>

      {!email ? (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl">Verify your Gmail to continue</CardTitle>
            <CardDescription>
              Quizzes are only available to registered participants on the quiz&apos;s learning track.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AuthSignIn onVerifiedEmail={setEmail} onSessionLost={() => setEmail(null)} />
            <Button variant="outline" size="sm" asChild>
              <Link href="/quiz">
                <ArrowLeft className="h-4 w-4" /> Back to my quizzes
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : loading ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading quiz…
        </p>
      ) : result && result.resultStatus === "PENDING_REVIEW" ? (
        <div className="space-y-4">
          {payload?.timedOut ? (
            <p className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
              <Clock className="mt-0.5 h-4 w-4 shrink-0" />
              The time for this quiz ran out while the page was closed, so it was submitted without your answers.
            </p>
          ) : null}
          <PendingView result={result} quiz={payload?.quiz} />
        </div>
      ) : result ? (
        <ResultView result={result} quiz={payload?.quiz} />
      ) : error ? (
        <Card className="glass-card">
          <CardContent className="space-y-4 py-10 text-center">
            <CircleSlash className="mx-auto h-8 w-8 text-red-600 dark:text-red-400" />
            <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            <Button variant="outline" size="sm" asChild>
              <Link href="/quiz">
                <ArrowLeft className="h-4 w-4" /> Back to my quizzes
              </Link>
            </Button>
          </CardContent>
        </Card>
      ) : payload ? (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardHeader>
              <CardTitle className="text-xl">{payload.quiz.title}</CardTitle>
              <CardDescription>{payload.quiz.description || "Answer every question, then submit."}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap items-center gap-2">
              <Badge variant="outline">{payload.quiz.questionCount} questions</Badge>
              <Badge variant="outline">{payload.quiz.totalPoints} points</Badge>
              <Badge variant="secondary">{payload.quiz.trackName}</Badge>
              <QuizWindowBadge
                window={{
                  opensAt: payload.quiz.opensAt ?? null,
                  closesAt: payload.quiz.closesAt ?? null,
                }}
              />
              {remainingSeconds !== null ? (
                <Badge variant={expired || remainingSeconds <= 60 ? "destructive" : "outline"} aria-live="polite">
                  <Clock className="mr-1 h-3.5 w-3.5" />
                  {expired ? "Time is up" : `${formatCountdown(remainingSeconds)} left`}
                </Badge>
              ) : null}
            </CardContent>
            {timed ? (
              <p className="flex items-start gap-2 border-t border-border px-6 py-3 text-xs text-muted-foreground">
                <Clock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                {expired
                  ? "The time is up, so your answers are being submitted."
                  : "This quiz is timed. The clock started when you opened it and keeps running if you close the page, and your answers are submitted automatically at zero."}
              </p>
            ) : null}
          </Card>

          {questions.map((question, index) => {
            const entry = answers[question.id] ?? { selectedOptionId: null, responseText: "" };
            const uploading = uploadingFor === question.id;
            return (
              <Card key={question.id} className="glass-card">
                <CardHeader>
                  <CardTitle className="text-base">
                    {index + 1}. {question.prompt}
                  </CardTitle>
                  <CardDescription>
                    {question.type === "OBJECTIVE" ? "Choose one option" : "Write your answer"} ·{" "}
                    {question.points} point{question.points === 1 ? "" : "s"}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {question.type === "OBJECTIVE" ? (
                    <div className="space-y-2">
                      {question.options.map((option) => (
                        <label
                          key={option.id}
                          className={`flex cursor-pointer items-center gap-3 rounded-md border p-3 text-sm transition-colors ${
                            entry.selectedOptionId === option.id
                              ? "border-primary bg-primary/10"
                              : "hover:bg-accent"
                          }`}
                        >
                          <input
                            type="radio"
                            name={`question-${question.id}`}
                            value={option.id}
                            checked={entry.selectedOptionId === option.id}
                            onChange={() =>
                              setAnswers((prev) => ({
                                ...prev,
                                [question.id]: { ...entry, selectedOptionId: option.id },
                              }))
                            }
                            className="h-4 w-4"
                          />
                          <span>{option.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label htmlFor={`answer-${question.id}`}>Your answer</Label>
                        <textarea
                          id={`answer-${question.id}`}
                          rows={question.type === "LONG_TEXT" ? 6 : 2}
                          value={entry.responseText}
                          onChange={(event) =>
                            setAnswers((prev) => ({
                              ...prev,
                              [question.id]: { ...entry, responseText: event.target.value },
                            }))
                          }
                          placeholder={
                            entry.file ? "A PDF is attached, you can still add a note here…" : "Type your answer here…"
                          }
                          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        />
                      </div>

                      <div className="space-y-1.5 rounded-md border border-dashed p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <Label htmlFor={`answer-file-${question.id}`} className="flex items-center gap-1.5">
                            <FileText className="h-4 w-4" /> Or answer with a PDF
                          </Label>
                          <div className="flex items-center gap-1.5">
                            {entry.file ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => clearAnswerPdf(question.id)}
                                disabled={uploading}
                              >
                                <X className="h-4 w-4" /> Remove
                              </Button>
                            ) : null}
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() => fileInputs.current[question.id]?.click()}
                              disabled={uploading}
                            >
                              {uploading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Upload className="h-4 w-4" />
                              )}
                              {uploading ? "Uploading…" : "Upload PDF"}
                            </Button>
                          </div>
                        </div>

                        <input
                          id={`answer-file-${question.id}`}
                          ref={(node) => {
                            fileInputs.current[question.id] = node;
                          }}
                          type="file"
                          accept="application/pdf,.pdf"
                          className="hidden"
                          disabled={uploading}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            if (file) void uploadAnswerPdf(question.id, file);
                          }}
                        />

                        {entry.file ? (
                          <p className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                            <span className="font-medium text-foreground">{entry.file.fileName}</span>
                            <span>
                              {entry.file.pages} page{entry.file.pages === 1 ? "" : "s"} ·{" "}
                              {entry.file.characters.toLocaleString()} characters will be graded
                            </span>
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            The text is extracted from your PDF and graded by the AI
                            {maxPages ? `, up to ${maxPages} pages` : ""}. Scanned documents need selectable text.
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {uploadError ? <p className="text-sm text-red-600 dark:text-red-400">{uploadError}</p> : null}

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">
              {answeredCount} of {questions.length} answered
            </p>
            <div className="flex gap-2">
              <Button variant="outline" asChild>
                <Link href="/quiz">
                  <ArrowLeft className="h-4 w-4" /> Back
                </Link>
              </Button>
              <Button onClick={submit} disabled={submitting || expired}>
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                Submit answers
              </Button>
            </div>
          </div>

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            You only get one attempt. Once you submit, a community manager reviews the result before you can see it.
          </p>
        </div>
      ) : null}
    </div>
  );
}

/** Shown until a manager approves the attempt: no score, no correct answers, no AI verdicts. */
function PendingView({ result, quiz }: { result: AttemptResultView; quiz?: QuizSummaryView }) {
  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader className="text-center">
          <Clock className="mx-auto h-10 w-10 text-amber-500" />
          <CardTitle className="text-2xl">Your answers are in</CardTitle>
          <CardDescription>
            {quiz?.title ? `${quiz.title} · ` : ""}Submitted {formatDateTime(result.submittedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <Badge variant="secondary" className="mx-auto">
            Awaiting review
          </Badge>
          <p className="text-center text-sm text-muted-foreground">
            Your answers were graded automatically and are now waiting for a community manager to review them.
            Your score, the correct answers and the AI feedback stay hidden until then, and you will be able to
            see them here.
          </p>
          <p className="flex items-start justify-center gap-2 text-center text-xs text-muted-foreground">
            <CircleSlash className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            You only get one attempt, so there is nothing left to submit for this quiz.
          </p>
          <Button variant="outline" className="w-full" asChild>
            <Link href="/quiz">
              <ArrowLeft className="h-4 w-4" /> Back to my quizzes
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

function ResultView({ result, quiz }: { result: AttemptResultView; quiz?: QuizSummaryView }) {
  const passed = result.percentage >= 50;
  const pending = result.resultStatus === "PENDING_REVIEW";

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader className="text-center">
          <Award className={`mx-auto h-10 w-10 ${passed ? "text-green-600" : "text-amber-500"}`} />
          <CardTitle className="text-2xl">Your result</CardTitle>
          <CardDescription>
            {quiz?.title ? `${quiz.title} · ` : ""}Submitted {formatDateTime(result.submittedAt)}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-center gap-3">
            <span className="text-4xl font-bold">
              {result.score}/{result.maxScore}
            </span>
            <Badge variant={passed ? "default" : "secondary"} className={passed ? "bg-green-600 hover:bg-green-600" : ""}>
              {result.percentage}%
            </Badge>
          </div>
          <p className="text-center text-sm text-muted-foreground">
            {result.answers.filter((answer) => answer.isCorrect).length} of {result.answers.length} answers correct
          </p>
          {result.publishedAt ? (
            <p className="flex items-center justify-center gap-1 text-xs text-muted-foreground">
              <CheckCircle2 className="h-3 w-3" />
              Published {formatDateTime(result.publishedAt)}
            </p>
          ) : null}
          <Button variant="outline" className="w-full" asChild>
            <Link href="/quiz">
              <ArrowLeft className="h-4 w-4" /> Back to my quizzes
            </Link>
          </Button>
        </CardContent>
      </Card>

      {result.answers.map((answer, index) => (
        <Card key={answer.questionId} className="glass-card">
          <CardHeader>
            <CardTitle className="text-base">
              {index + 1}. {answer.prompt}
            </CardTitle>
            <CardDescription className="flex flex-wrap items-center gap-2">
              {answer.isCorrect ? (
                <span className="inline-flex items-center gap-1 font-medium text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Correct · {answer.pointsAwarded}/{answer.points} points
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 font-medium text-red-600 dark:text-red-400">
                  <CircleSlash className="h-3.5 w-3.5" /> Incorrect · {answer.pointsAwarded}/{answer.points} points
                </span>
              )}
              <Badge variant="outline">{GRADING_METHOD_LABELS[answer.gradedBy]}</Badge>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {answer.responseFileUrl ? (
              <p>
                <span className="text-muted-foreground">Your PDF: </span>
                <a
                  href={answer.responseFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  answer.pdf ({answer.responseFilePages} page{answer.responseFilePages === 1 ? "" : "s"})
                </a>
              </p>
            ) : null}
            <p>
              <span className="text-muted-foreground">Your answer: </span>
              {answer.responseText || "—"}
            </p>
            {!answer.isCorrect && answer.expectedAnswers.length ? (
              <p>
                <span className="text-muted-foreground">
                  {answer.type === "OBJECTIVE" ? "Correct option" : "Accepted answer"}:{" "}
                </span>
                {answer.expectedAnswers.join(" | ")}
              </p>
            ) : null}
            {answer.explanation ? (
              <p className="rounded-md bg-muted/50 p-3 text-muted-foreground">{answer.explanation}</p>
            ) : null}
            {!pending && (answer.aiReason || answer.similarity !== null) ? (
              <div className="space-y-1 rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">
                  <Bot className="mr-1 inline h-3 w-3" />
                  How this was graded
                </p>
                {answer.similarity !== null ? (
                  <p>Legacy embedding score: {(answer.similarity * 100).toFixed(1)}%</p>
                ) : null}
                {answer.aiReason ? <p>{answer.aiReason}</p> : null}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}