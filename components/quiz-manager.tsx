"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  CheckCircle2,
  Clock,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Undo2,
} from "lucide-react";
import { emptyQuestion } from "@/components/question-editor";
import { QuizEditor } from "@/components/quiz-editor";
import { useModal } from "@/components/use-modal";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDateTime } from "@/lib/format";
import {
  GRADING_METHOD_LABELS,
  type QuestionKind,
  type QuestionDraft,
  type QuizAttemptSummary,
  type QuizDetail,
  type QuizDraft,
  type QuizSummary,
} from "@/lib/types";

const emailHeader = (email: string) => ({ "X-User-Email": email });

type Props = {
  email: string;
  trackOptions: string[];
  lockedTrack?: string;
};

type AttemptsPayload = {
  quiz: { id: string; title: string; trackName: string; totalPoints: number; durationMinutes: number };
  questions: {
    id: string;
    prompt: string;
    type: string;
    points: number;
    correctLabels: string[];
    referenceFileUrl: string;
    referenceFilePages: number;
  }[];
  attempts: QuizAttemptSummary[];
};

export function QuizManager({ email, trackOptions, lockedTrack }: Props) {
  const { showAlert, confirm, dialogs } = useModal();
  const [quizzes, setQuizzes] = useState<QuizSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [trackFilter, setTrackFilter] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const [draft, setDraft] = useState<QuizDraft | null>(null);
  const [lockedQuestions, setLockedQuestions] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draftError, setDraftError] = useState("");

  const [attempts, setAttempts] = useState<AttemptsPayload | null>(null);
  const [attemptsLoading, setAttemptsLoading] = useState(false);
  const [openAttempt, setOpenAttempt] = useState<string | null>(null);
  const [publishingId, setPublishingId] = useState<string | null>(null);
  const [override, setOverride] = useState<Record<string, string>>({});
  const [feedback, setFeedback] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (!lockedTrack && trackFilter) params.set("track", trackFilter);
      const res = await fetch(`/api/quizzes${params.toString() ? `?${params.toString()}` : ""}`, {
        headers: emailHeader(email),
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 401 || res.status === 403) {
        window.location.href = "/login";
        return;
      }
      if (!res.ok) {
        setQuizzes([]);
        setError(data.error || "Failed to load quizzes.");
        return;
      }
      setQuizzes(data.data ?? []);
    } catch {
      setError("Network error while loading quizzes.");
    } finally {
      setLoading(false);
    }
  }, [email, lockedTrack, trackFilter]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quizzes;
    return quizzes.filter(
      (quiz) =>
        quiz.title.toLowerCase().includes(term) ||
        quiz.description.toLowerCase().includes(term) ||
        quiz.trackName.toLowerCase().includes(term)
    );
  }, [quizzes, search]);

  function startNew() {
    setLockedQuestions(false);
    setDraftError("");
    setDraft({
      id: null,
      title: "",
      description: "",
      published: false,
      trackName: lockedTrack ?? trackOptions[0] ?? "",
      durationMinutes: 0,
      questions: [emptyQuestion()],
    });
  }

  async function openQuiz(id: string) {
    setDraftError("");
    setSaving(false);
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(id)}`, { headers: emailHeader(email) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Failed to load that quiz.");
        return;
      }
      const quiz: QuizDetail = data.data;
      setLockedQuestions(quiz.locked);
      setDraft({
        id: quiz.id,
        title: quiz.title,
        description: quiz.description,
        published: quiz.published,
        trackName: quiz.trackName,
        durationMinutes: quiz.durationMinutes ?? 0,
        questions: quiz.questions.map((question) => ({
          key: question.id,
          id: question.id,
          prompt: question.prompt,
          type: question.type as QuestionKind,
          points: question.points,
          explanation: question.explanation,
          referenceFileUrl: question.referenceFileUrl ?? "",
          referenceFilePages: question.referenceFilePages ?? 0,
          referenceFileText: question.referenceFileText ?? "",
          referenceFileName: question.referenceFileUrl
            ? decodeURIComponent(question.referenceFileUrl.split("/").pop()?.split(".")[0] ?? "reference.pdf")
            : "",
          options: question.options.map((option) => ({
            key: option.id,
            id: option.id,
            label: option.label,
            isCorrect: option.isCorrect,
          })),
        })),
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError("Network error while loading that quiz.");
    }
  }

  function toPayload(target: QuizDraft) {
    return {
      title: target.title,
      description: target.description,
      published: target.published,
      trackName: target.trackName,
      durationMinutes: target.durationMinutes,
      questions: target.questions.map((question: QuestionDraft) => ({
        id: question.id,
        prompt: question.prompt,
        type: question.type,
        points: question.points,
        explanation: question.explanation,
        referenceFileUrl: question.referenceFileUrl,
        referenceFileText: question.referenceFileText,
        referenceFilePages: question.referenceFilePages,
        options: question.options.map((option) => ({ label: option.label, isCorrect: option.isCorrect })),
      })),
    };
  }

  async function save() {
    if (!draft) return;
    if (!draft.title.trim()) {
      setDraftError("Give the quiz a title first.");
      return;
    }
    if (!lockedTrack && !draft.trackName) {
      setDraftError("Choose the learning track this quiz belongs to.");
      return;
    }

    setSaving(true);
    setDraftError("");
    try {
      const isEdit = Boolean(draft.id);
      const res = await fetch(
        isEdit ? `/api/quizzes/${encodeURIComponent(draft.id as string)}` : "/api/quizzes",
        {
          method: isEdit ? "PUT" : "POST",
          headers: { ...emailHeader(email), "Content-Type": "application/json" },
          body: JSON.stringify(toPayload(draft)),
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDraftError(data.error || "Could not save the quiz.");
        return;
      }
      setDraft(null);
      setReloadKey((key) => key + 1);
    } catch {
      setDraftError("Network error while saving the quiz.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished(quiz: QuizSummary) {
    setError("");
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(quiz.id)}`, {
        method: "PUT",
        headers: { ...emailHeader(email), "Content-Type": "application/json" },
        body: JSON.stringify({
          title: quiz.title,
          description: quiz.description,
          published: !quiz.published,
          trackName: quiz.trackName,
          durationMinutes: quiz.durationMinutes,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not update the quiz.");
        return;
      }
      setReloadKey((key) => key + 1);
    } catch {
      setError("Network error while updating the quiz.");
    }
  }

  async function removeQuiz(quiz: QuizSummary) {
    const warning = quiz.attemptCount
      ? `This will also remove all ${quiz.attemptCount} recorded attempt(s) for this quiz.`
      : "This quiz has no attempts yet.";
    const ok = await confirm(
      `Delete "${quiz.title}"?`,
      `${warning} This cannot be undone.`,
      { confirmLabel: "Delete quiz", destructive: true }
    );
    if (!ok) return;
    setError("");
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(quiz.id)}`, {
        method: "DELETE",
        headers: emailHeader(email),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not delete the quiz.");
        return;
      }
      if (draft?.id === quiz.id) setDraft(null);
      setAttempts(null);
      setReloadKey((key) => key + 1);
    } catch {
      setError("Network error while deleting the quiz.");
    }
  }

  async function openAttempts(quiz: QuizSummary) {
    setAttemptsLoading(true);
    setError("");
    setOpenAttempt(null);
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(quiz.id)}/attempts`, {
        headers: emailHeader(email),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not load attempts.");
        return;
      }
      setAttempts(data.data);
      const pending = (data.data?.attempts ?? []).filter(
        (attempt: QuizAttemptSummary) => attempt.resultStatus === "PENDING_REVIEW"
      ).length;
      setOverride({});
      setFeedback({});
      if (pending > 0) {
        await showAlert(
          "Results awaiting review",
          `${pending} attempt${pending === 1 ? "" : "s"} must be reviewed and published before participants can see their scores.`,
          "info"
        );
      }
    } catch {
      setError("Network error while loading attempts.");
    } finally {
      setAttemptsLoading(false);
    }
  }

  /** Approves an attempt, which is what reveals the score to the participant. */
  async function publishAttempt(attempt: QuizAttemptSummary) {
    const score = override[attempt.id]?.trim();
    const ok = await confirm(
      `Publish the result for ${attempt.participantName || attempt.participantEmail}?`,
      score
        ? `The published score will be ${score} out of ${attempt.maxScore}. The participant will immediately see this score and the AI evaluation.`
        : "The participant will immediately see their score and the AI evaluation for every answer.",
      { confirmLabel: "Publish result" }
    );
    if (!ok) return;

    setPublishingId(attempt.id);
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(attempts?.quiz.id ?? "")}/publish`, {
        method: "POST",
        headers: { ...emailHeader(email), "Content-Type": "application/json" },
        body: JSON.stringify({
          attemptId: attempt.id,
          adjustedScore: score === "" ? null : score,
          feedback: feedback[attempt.id] ?? "",
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not publish this result.");
        return;
      }
      await showAlert("Result published", data.message || "The participant can now see their score.", "success");
      await openAttempts({ id: attempts?.quiz.id ?? "" } as QuizSummary);
    } catch {
      setError("Network error while publishing the result.");
    } finally {
      setPublishingId(null);
    }
  }

  async function withdrawAttempt(attempt: QuizAttemptSummary) {
    const ok = await confirm(
      "Withdraw this published result?",
      `${attempt.participantName || attempt.participantEmail} will no longer be able to see their score until you publish it again.`,
      { confirmLabel: "Withdraw result", destructive: true }
    );
    if (!ok) return;

    setPublishingId(attempt.id);
    try {
      const res = await fetch(`/api/quizzes/${encodeURIComponent(attempts?.quiz.id ?? "")}/publish`, {
        method: "DELETE",
        headers: { ...emailHeader(email), "Content-Type": "application/json" },
        body: JSON.stringify({ attemptId: attempt.id }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not withdraw this result.");
        return;
      }
      await showAlert("Result withdrawn", data.message || "The result is back under review.", "success");
      await openAttempts({ id: attempts?.quiz.id ?? "" } as QuizSummary);
    } catch {
      setError("Network error while withdrawing the result.");
    } finally {
      setPublishingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <Card className="glass-card">
        <CardHeader>
          <CardTitle className="text-lg">Quizzes</CardTitle>
          <CardDescription>
            {lockedTrack
              ? `Create, publish and grade quizzes for the ${lockedTrack} track. Only participants in this track can take them.`
              : "Create, publish and grade quizzes across every learning track."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_14rem_auto]">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search quizzes by title or track…"
                className="pl-9"
                aria-label="Search quizzes"
              />
            </div>

            {lockedTrack ? (
              <Input value={lockedTrack} disabled aria-label="Your track" />
            ) : (
              <Select value={trackFilter || "__all"} onValueChange={(value) => setTrackFilter(value === "__all" ? "" : value)}>
                <SelectTrigger aria-label="Filter by track">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all">All tracks</SelectItem>
                  {trackOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <div className="flex gap-2">
              <Button onClick={startNew} className="flex-1 lg:flex-none">
                <Plus className="h-4 w-4" /> New quiz
              </Button>
              <Button
                variant="outline"
                onClick={() => setReloadKey((key) => key + 1)}
                disabled={loading}
                aria-label="Refresh quizzes"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
              </Button>
            </div>
          </div>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          {loading ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading quizzes…
            </p>
          ) : visible.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              {quizzes.length === 0
                ? "No quizzes yet. Use “New quiz” to build your first one."
                : "No quizzes match your search."}
            </p>
          ) : (
            <ul className="space-y-2">
              {visible.map((quiz) => (
                <li
                  key={quiz.id}
                  className="flex flex-col gap-3 rounded-md border border-border bg-background/60 p-3 sm:flex-row sm:items-center"
                >
                  <div className="flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{quiz.title}</span>
                      {quiz.published ? (
                        <Badge className="bg-green-600 text-white hover:bg-green-600">Published</Badge>
                      ) : (
                        <Badge variant="secondary">Draft</Badge>
                      )}
                      {!lockedTrack ? <Badge variant="outline">{quiz.trackName}</Badge> : null}
                      {quiz.attemptCount > 0 ? (
                        <Badge variant="outline" title="Questions are locked once a quiz has attempts">
                          <BarChart3 className="h-3 w-3" /> {quiz.attemptCount} attempt
                          {quiz.attemptCount === 1 ? "" : "s"}
                        </Badge>
                      ) : null}
                      <Badge variant="outline" title="Time limit for one attempt">
                        <Clock className="h-3 w-3" />
                        {quiz.durationMinutes > 0 ? `${quiz.durationMinutes} min limit` : "No time limit"}
                      </Badge>
                    </div>
                    {quiz.description ? (
                      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{quiz.description}</p>
                    ) : null}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {quiz.questionCount} question{quiz.questionCount === 1 ? "" : "s"} · {quiz.totalPoints} points ·
                      updated {formatDateTime(quiz.updatedAt)}
                    </p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button size="sm" variant="secondary" onClick={() => togglePublished(quiz)}>
                      {quiz.published ? "Unpublish" : "Publish"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => openAttempts(quiz)} disabled={attemptsLoading}>
                      <BarChart3 className="h-4 w-4" /> Results
                    </Button>
                    <Button size="sm" variant="secondary" onClick={() => openQuiz(quiz.id)}>
                      <Pencil className="h-4 w-4" /> Edit
                    </Button>
                    <Button size="sm" variant="destructive" onClick={() => removeQuiz(quiz)}>
                      <Trash2 className="h-4 w-4" /> Delete
                    </Button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {draft ? (
        <QuizEditor
          draft={draft}
          trackOptions={trackOptions}
          lockedTrack={lockedTrack}
          lockedQuestions={lockedQuestions}
          saving={saving}
          error={draftError}
          email={email}
          onChange={setDraft}
          onSave={save}
          onCancel={() => setDraft(null)}
        />
      ) : null}

      {attemptsLoading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading results…
        </p>
      ) : attempts ? (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Results — {attempts.quiz.title}</CardTitle>
            <CardDescription>
              {attempts.attempts.length} attempt{attempts.attempts.length === 1 ? "" : "s"} out of{" "}
              {attempts.quiz.totalPoints} points
              {attempts.quiz.durationMinutes > 0 ? ` · ${attempts.quiz.durationMinutes} minute time limit` : " with no time limit"}. Scores stay hidden from participants until you publish them.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {attempts.attempts.length === 0 ? (
              <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
                Nobody has taken this quiz yet.
              </p>
            ) : (
              <div className="space-y-2">
                {attempts.attempts.map((attempt) => {
                  const expanded = openAttempt === attempt.id;
                  const published = attempt.resultStatus === "PUBLISHED";
                  const effectiveScore = attempt.adjustedScore ?? attempt.score;
                  const effectiveMax = attempt.adjustedMaxScore ?? attempt.maxScore;
                  const effectivePercentage =
                    effectiveMax > 0 ? Math.round((effectiveScore / effectiveMax) * 1000) / 10 : attempt.percentage;
                  return (
                    <div key={attempt.id} className="rounded-md border border-border bg-background/60 p-3">
                      <button
                        type="button"
                        className="flex w-full flex-wrap items-center justify-between gap-3 text-left"
                        onClick={() => setOpenAttempt(expanded ? null : attempt.id)}
                        aria-expanded={expanded}
                      >
                        <div>
                          <p className="font-medium">
                            {attempt.participantName || attempt.participantEmail}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {attempt.participantEmail} · {formatDateTime(attempt.submittedAt)}
                          </p>
                          {published && attempt.publishedAt ? (
                            <p className="text-xs text-muted-foreground">
                              Published {formatDateTime(attempt.publishedAt)}
                              {attempt.publishedBy ? ` by ${attempt.publishedBy}` : ""}
                            </p>
                          ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant={published ? "default" : "secondary"}>
                            {published ? "Published" : "Awaiting review"}
                          </Badge>
                          <Badge variant={effectivePercentage >= 50 ? "default" : "secondary"}>
                            {effectiveScore}/{effectiveMax} · {effectivePercentage}%
                          </Badge>
                          <span className="text-xs text-muted-foreground">{expanded ? "Hide" : "Details"}</span>
                        </div>
                      </button>

                      {expanded ? (
                        <div className="mt-3 space-y-3 border-t pt-3">
                          {attempts.questions.map((question, index) => {
                            const answer = attempt.answers.find((item) => item.questionId === question.id);
                            return (
                              <div key={question.id} className="rounded-md bg-muted/40 p-3">
                                <p className="text-sm font-medium">
                                  {index + 1}. {question.prompt}
                                </p>
                                <p className="mt-1 text-xs text-muted-foreground">
                                  Correct answer: {question.correctLabels.join(" | ") || "—"}
                                </p>
                                {question.referenceFileUrl ? (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    Reference document:{" "}
                                    <a
                                      href={question.referenceFileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-medium text-primary underline underline-offset-2"
                                    >
                                      open PDF ({question.referenceFilePages} page
                                      {question.referenceFilePages === 1 ? "" : "s"})
                                    </a>
                                  </p>
                                ) : null}
                                {answer?.responseFileUrl ? (
                                  <p className="mt-1 text-sm">
                                    Uploaded PDF:{" "}
                                    <a
                                      href={answer.responseFileUrl}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="font-medium text-primary underline underline-offset-2"
                                    >
                                      open answer ({answer.responseFilePages} page
                                      {answer.responseFilePages === 1 ? "" : "s"})
                                    </a>
                                  </p>
                                ) : null}
                                <p className="mt-1 text-sm">
                                  Response: {answer?.responseText || "—"}
                                </p>
                                <p
                                  className={`mt-1 text-xs font-medium ${
                                    answer?.isCorrect ? "text-green-700 dark:text-green-400" : "text-red-600 dark:text-red-400"
                                  }`}
                                >
                                  {answer?.isCorrect ? "Correct" : "Incorrect"} · {answer?.pointsAwarded ?? 0}/
                                  {question.points} points
                                </p>
                                {answer ? (
                                  <div className="mt-2 space-y-1 border-l-2 border-border pl-2 text-xs text-muted-foreground">
                                    <p className="font-medium text-foreground">
                                      <Bot className="mr-1 inline h-3 w-3" />
                                      {GRADING_METHOD_LABELS[answer.gradedBy]}
                                    </p>
                                    {answer.similarity !== null ? (
                                      <p>
                                        Legacy embedding score: {(answer.similarity * 100).toFixed(1)}%
                                      </p>
                                    ) : null}
                                    {answer.aiScore !== null ? (
                                      <p>AI awarded {(answer.aiScore * 100).toFixed(0)}% of this question</p>
                                    ) : null}
                                    {answer.aiReason ? <p>Reason: {answer.aiReason}</p> : null}
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}

                          <div className="space-y-2 rounded-md border border-dashed p-3">
                            <p className="text-xs font-medium">
                              {published ? "Adjust the published result" : "Approve and publish this result"}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              Leave the score blank to publish the automatically graded score of {attempt.score}/
                              {attempt.maxScore}.
                            </p>
                            <div className="flex flex-wrap items-end gap-2">
                              <div className="w-32 space-y-1">
                                <Label className="text-xs" htmlFor={`override-${attempt.id}`}>
                                  Score override
                                </Label>
                                <Input
                                  id={`override-${attempt.id}`}
                                  inputMode="decimal"
                                  placeholder={`${attempt.score}`}
                                  value={override[attempt.id] ?? ""}
                                  onChange={(event) =>
                                    setOverride((current) => ({ ...current, [attempt.id]: event.target.value }))
                                  }
                                />
                              </div>
                              <div className="min-w-48 flex-1 space-y-1">
                                <Label className="text-xs" htmlFor={`feedback-${attempt.id}`}>
                                  Note to the participant
                                </Label>
                                <Input
                                  id={`feedback-${attempt.id}`}
                                  placeholder="Optional message shown with the result"
                                  value={feedback[attempt.id] ?? ""}
                                  onChange={(event) =>
                                    setFeedback((current) => ({ ...current, [attempt.id]: event.target.value }))
                                  }
                                />
                              </div>
                              {published ? (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  disabled={publishingId === attempt.id}
                                  onClick={() => withdrawAttempt(attempt)}
                                >
                                  {publishingId === attempt.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Undo2 className="h-4 w-4" />
                                  )}
                                  Withdraw
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  disabled={publishingId === attempt.id}
                                  onClick={() => publishAttempt(attempt)}
                                >
                                  {publishingId === attempt.id ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Send className="h-4 w-4" />
                                  )}
                                  Publish result
                                </Button>
                              )}
                            </div>
                            {attempt.adjustedFeedback ? (
                              <p className="flex items-start gap-1 text-xs text-muted-foreground">
                                <CheckCircle2 className="mt-0.5 h-3 w-3 shrink-0" />
                                {attempt.adjustedFeedback}
                              </p>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      ) : null}

      {dialogs}
    </div>
  );
}