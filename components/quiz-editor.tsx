"use client";

import { CalendarClock, Clock, Loader2, Plus, Save, X } from "lucide-react";
import { emptyQuestion, QuestionEditor } from "@/components/question-editor";
import { NumericInput } from "@/components/numeric-input";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { describeWindow, fromDateTimeLocalValue, toDateTimeLocalValue } from "@/lib/quiz-window";
import type { QuestionDraft, QuizDraft } from "@/lib/types";
import { MAX_QUIZ_DURATION_MINUTES } from "@/lib/types";

type Props = {
  draft: QuizDraft;
  trackOptions: string[];
  lockedTrack?: string;
  lockedQuestions: boolean;
  saving: boolean;
  error: string;
  email: string;
  onChange: (draft: QuizDraft) => void;
  onSave: () => void;
  onCancel: () => void;
};

export function QuizEditor({
  draft,
  trackOptions,
  lockedTrack,
  lockedQuestions,
  saving,
  error,
  email,
  onChange,
  onSave,
  onCancel,
}: Props) {
  const totalPoints = draft.questions.reduce((sum, question) => sum + (Number(question.points) || 0), 0);

  function patchQuestion(key: string, next: QuestionDraft) {
    onChange({
      ...draft,
      questions: draft.questions.map((question) => (question.key === key ? next : question)),
    });
  }

  function moveQuestion(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= draft.questions.length) return;
    const next = [...draft.questions];
    [next[index], next[target]] = [next[target], next[index]];
    onChange({ ...draft, questions: next });
  }

  return (
    <div className="rounded-md border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-lg font-semibold">{draft.id ? "Edit quiz" : "New quiz"}</h3>
        <Button type="button" variant="ghost" size="icon" onClick={onCancel} aria-label="Close editor">
          <X className="h-4 w-4" />
        </Button>
      </div>

      {lockedQuestions ? (
        <p className="mb-4 rounded-md border border-amber-500/40 bg-amber-500/10 p-3 text-sm text-amber-700 dark:text-amber-300">
          Somebody has already taken this quiz, so the questions are locked to keep their results accurate. You can
          still change the title, description, availability window, time limit and publish state, or create a fresh
          quiz with new questions.
        </p>
      ) : null}

      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quiz-title">Quiz title</Label>
            <Input
              id="quiz-title"
              value={draft.title}
              onChange={(event) => onChange({ ...draft, title: event.target.value })}
              placeholder="e.g. Python Basics — Week 1 assessment"
              disabled={saving}
            />
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="quiz-description">Instructions</Label>
            <textarea
              id="quiz-description"
              value={draft.description}
              onChange={(event) => onChange({ ...draft, description: event.target.value })}
              rows={2}
              placeholder="Shown to participants before they start."
              disabled={saving}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            />
          </div>

          <div className="space-y-4 rounded-md border border-border bg-muted/30 p-3 sm:col-span-2">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm font-medium">When participants can take this quiz</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-1.5">
                <Label htmlFor="quiz-duration">Time limit (minutes)</Label>
                <NumericInput
                  id="quiz-duration"
                  value={draft.durationMinutes}
                  onCommit={(durationMinutes) => onChange({ ...draft, durationMinutes })}
                  min={0}
                  max={MAX_QUIZ_DURATION_MINUTES}
                  placeholder="0"
                  disabled={saving}
                />
                <p className="text-xs text-muted-foreground">
                  {draft.durationMinutes > 0
                    ? `${draft.durationMinutes} minute${draft.durationMinutes === 1 ? "" : "s"} per attempt, submitted automatically at zero.`
                    : "0 means no limit. The clock starts when the quiz is opened."}
                </p>
              </div>

              <WindowInput
                id="quiz-opens-at"
                label="Opens at"
                icon={<Clock className="h-3.5 w-3.5" />}
                value={draft.opensAt}
                max={draft.closesAt ? toDateTimeLocalValue(draft.closesAt) : undefined}
                onChange={(iso) => onChange({ ...draft, opensAt: iso })}
                disabled={saving}
              />

              <WindowInput
                id="quiz-closes-at"
                label="Closes at"
                icon={<Clock className="h-3.5 w-3.5" />}
                value={draft.closesAt}
                min={draft.opensAt ? toDateTimeLocalValue(draft.opensAt) : undefined}
                onChange={(iso) => onChange({ ...draft, closesAt: iso })}
                disabled={saving}
              />
            </div>

            <p className="text-xs text-muted-foreground">
              {describeWindow({ opensAt: draft.opensAt, closesAt: draft.closesAt })} Leaving both empty keeps the
              quiz open for as long as it stays published. The closing time only stops new attempts; somebody already
              inside their own countdown is allowed to finish.
            </p>
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <Label>Learning track</Label>
            {lockedTrack ? (
              <Input value={lockedTrack} readOnly disabled />
            ) : (
              <Select value={draft.trackName} onValueChange={(value) => onChange({ ...draft, trackName: value })}>
                <SelectTrigger aria-label="Learning track">
                  <SelectValue placeholder="Select track" />
                </SelectTrigger>
                <SelectContent>
                  {trackOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="flex items-end gap-3 pb-2 sm:col-span-2">
            <label className="flex cursor-pointer items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={draft.published}
                disabled={saving}
                onChange={(event) => onChange({ ...draft, published: event.target.checked })}
                className="h-4 w-4 rounded border-input"
              />
              Published — participants in this track can take it
            </label>
          </div>
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">
              Questions{" "}
              <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                {draft.questions.length}
              </span>
              <span className="ml-2 text-xs font-normal text-muted-foreground">{totalPoints} points total</span>
            </p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ ...draft, questions: [...draft.questions, emptyQuestion()] })}
              disabled={saving || lockedQuestions}
            >
              <Plus className="h-4 w-4" /> Add question
            </Button>
          </div>

          {draft.questions.length === 0 ? (
            <p className="rounded-md border border-dashed p-8 text-center text-sm text-muted-foreground">
              No questions yet. Add your first question to build the quiz.
            </p>
          ) : (
            draft.questions.map((question, index) => (
              <QuestionEditor
                key={question.key}
                question={question}
                index={index}
                total={draft.questions.length}
                disabled={saving || lockedQuestions}
                onChange={(next) => patchQuestion(question.key, next)}
                onRemove={() =>
                  onChange({
                    ...draft,
                    questions: draft.questions.filter((item) => item.key !== question.key),
                  })
                }
                onMove={(direction) => moveQuestion(index, direction)}
                email={email}
              />
            ))
          )}
        </div>

        {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
            Cancel
          </Button>
          <Button type="button" onClick={onSave} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {draft.id ? "Save changes" : "Create quiz"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/**
 * One bound of the availability window. The value lives in the draft as an ISO timestamp and is
 * converted to the local `datetime-local` shape the browser understands, so a manager always sees
 * the date in their own timezone.
 */
function WindowInput({
  id,
  label,
  icon,
  value,
  min,
  max,
  onChange,
  disabled,
}: {
  id: string;
  label: string;
  icon: React.ReactNode;
  value: string | null;
  min?: string;
  max?: string;
  onChange: (iso: string | null) => void;
  disabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input
        id={id}
        type="datetime-local"
        value={toDateTimeLocalValue(value)}
        min={min}
        max={max}
        onChange={(event) => onChange(fromDateTimeLocalValue(event.target.value))}
        disabled={disabled}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {icon}
        {value ? (
          <>
            <span className="min-w-0 flex-1 truncate">Your local time</span>
            <button
              type="button"
              className="shrink-0 font-medium text-primary underline underline-offset-2"
              onClick={() => onChange(null)}
              disabled={disabled}
            >
              Clear
            </button>
          </>
        ) : (
          "Not set"
        )}
      </p>
    </div>
  );
}
