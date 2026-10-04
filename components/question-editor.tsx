"use client";

import { useRef, useState } from "react";
import { ArrowDown, ArrowUp, Check, FileText, Loader2, Plus, Trash2, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { QUESTION_KIND_LABELS, QUESTION_TYPE_VALUES, type QuestionDraft, type QuestionKind } from "@/lib/types";

let draftCounter = 0;
function nextKey(prefix: string) {
  draftCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${draftCounter}`;
}

export function emptyQuestion(type: QuestionKind = "OBJECTIVE"): QuestionDraft {
  const objective = type === "OBJECTIVE";
  return {
    key: nextKey("q"),
    prompt: "",
    type,
    points: 1,
    explanation: "",
    referenceFileUrl: "",
    referenceFilePages: 0,
    referenceFileName: "",
    referenceFileText: "",
    options: objective
      ? [
          { key: nextKey("o"), label: "", isCorrect: true },
          { key: nextKey("o"), label: "", isCorrect: false },
          { key: nextKey("o"), label: "", isCorrect: false },
          { key: nextKey("o"), label: "", isCorrect: false },
        ]
      : [{ key: nextKey("o"), label: "", isCorrect: true }],
  };
}

type Props = {
  question: QuestionDraft;
  index: number;
  total: number;
  disabled: boolean;
  onChange: (question: QuestionDraft) => void;
  onRemove: () => void;
  onMove: (direction: -1 | 1) => void;
  /** Signed-in manager address; the upload route requires it. */
  email: string;
};

export function QuestionEditor({ question, index, total, disabled, onChange, onRemove, onMove, email }: Props) {
  const subjective = question.type !== "OBJECTIVE";
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [maxPages, setMaxPages] = useState(0);

  async function uploadReference(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const body = new FormData();
      body.append("file", file);
      // The upload route identifies the signed-in manager through this header.
      const res = await fetch("/api/uploads/pdf", {
        method: "POST",
        headers: { "X-User-Email": email },
        body,
      });
      const payload = (await res.json()) as {
        error?: string;
        data?: { url: string; fileName: string; pagesAnalysed: number; maxPages: number; characters: number; text: string };
      };
      if (!res.ok || !payload.data) throw new Error(payload.error ?? "Upload failed.");

      onChange({
        ...question,
        referenceFileUrl: payload.data.url,
        referenceFilePages: payload.data.pagesAnalysed,
        referenceFileName: `${payload.data.fileName}.pdf`,
        referenceFileText: payload.data.text,
      });
      setMaxPages(payload.data.maxPages);
    } catch (error) {
      setUploadError(error instanceof Error ? error.message : "Upload failed.");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  function clearReference() {
    onChange({ ...question, referenceFileUrl: "", referenceFilePages: 0, referenceFileName: "", referenceFileText: "" });
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function updateOption(key: string, patch: Partial<QuestionDraft["options"][number]>) {
    onChange({
      ...question,
      options: question.options.map((option) => (option.key === key ? { ...option, ...patch } : option)),
    });
  }

  function markCorrect(key: string) {
    onChange({
      ...question,
      options: question.options.map((option) => ({ ...option, isCorrect: option.key === key })),
    });
  }

  function addOption() {
    onChange({
      ...question,
      options: [...question.options, { key: nextKey("o"), label: "", isCorrect: false }],
    });
  }

  function removeOption(key: string) {
    const remaining = question.options.filter((option) => option.key !== key);
    onChange({
      ...question,
      options: remaining.length ? remaining : [{ key: nextKey("o"), label: "", isCorrect: true }],
    });
  }

  function changeType(type: QuestionKind) {
    if (type === question.type) return;
    const fresh = emptyQuestion(type);
    onChange({
      ...question,
      type,
      options: fresh.options,
      // A reference document only makes sense for a written question.
      referenceFileUrl: type === "OBJECTIVE" ? "" : question.referenceFileUrl,
      referenceFilePages: type === "OBJECTIVE" ? 0 : question.referenceFilePages,
      referenceFileName: type === "OBJECTIVE" ? "" : question.referenceFileName,
      referenceFileText: type === "OBJECTIVE" ? "" : question.referenceFileText,
    });
  }

  return (
    <div className="rounded-md border bg-background/60 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-secondary px-2.5 py-0.5 text-xs font-semibold">Question {index + 1}</span>
          <BadgePill total={question.points} />
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={disabled || index === 0}
            onClick={() => onMove(-1)}
            aria-label="Move question up"
          >
            <ArrowUp className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            disabled={disabled || index === total - 1}
            onClick={() => onMove(1)}
            aria-label="Move question down"
          >
            <ArrowDown className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-red-600 hover:text-red-600"
            disabled={disabled}
            onClick={onRemove}
            aria-label="Remove question"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor={`prompt-${question.key}`}>Question</Label>
          <textarea
            id={`prompt-${question.key}`}
            value={question.prompt}
            onChange={(event) => onChange({ ...question, prompt: event.target.value })}
            disabled={disabled}
            rows={2}
            placeholder="e.g. Which HTTP method is used to update an existing resource?"
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <Label>Question type</Label>
            <Select value={question.type} onValueChange={(value) => changeType(value as QuestionKind)} disabled={disabled}>
              <SelectTrigger aria-label="Question type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {QUESTION_TYPE_VALUES.map((type) => (
                  <SelectItem key={type} value={type}>
                    {QUESTION_KIND_LABELS[type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`points-${question.key}`}>Points</Label>
            <Input
              id={`points-${question.key}`}
              type="number"
              min={1}
              max={100}
              value={question.points}
              disabled={disabled}
              onChange={(event) =>
                onChange({ ...question, points: Math.max(1, Number(event.target.value) || 1) })
              }
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor={`explanation-${question.key}`}>Explanation shown after the quiz</Label>
            <Input
              id={`explanation-${question.key}`}
              value={question.explanation}
              disabled={disabled}
              onChange={(event) => onChange({ ...question, explanation: event.target.value })}
              placeholder="Optional"
            />
          </div>
        </div>

        {subjective ? (
          <div className="space-y-2 rounded-md border border-dashed p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Label htmlFor={`reference-file-${question.key}`} className="flex items-center gap-1.5">
                  <FileText className="h-4 w-4" /> Reference PDF (optional)
                </Label>
              </div>
              <div className="flex items-center gap-1.5">
                {question.referenceFileUrl ? (
                  <Button type="button" variant="ghost" size="sm" onClick={clearReference} disabled={disabled || uploading}>
                    <X className="h-4 w-4" /> Remove
                  </Button>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={disabled || uploading}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  {uploading ? "Uploading..." : "Attach PDF"}
                </Button>
              </div>
            </div>

            <input
              id={`reference-file-${question.key}`}
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.pdf"
              className="hidden"
              disabled={disabled || uploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadReference(file);
              }}
            />

            {question.referenceFileUrl ? (
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <a
                  href={question.referenceFileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-primary underline underline-offset-2"
                >
                  {question.referenceFileName || "reference.pdf"}
                </a>
                <span>
                  {question.referenceFilePages} page{question.referenceFilePages === 1 ? "" : "s"} analysed by the AI
                </span>
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Attach a PDF with the full expected answer or extra context. The text is extracted and given to the AI
                alongside the accepted answers
                {maxPages ? ` (up to ${maxPages} pages)` : ""}.
              </p>
            )}

            {uploadError ? <p className="text-xs text-red-600">{uploadError}</p> : null}
          </div>
        ) : null}

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Label>{subjective ? "Expected answers (graded automatically)" : "Answer choices"}</Label>
            <Button type="button" variant="outline" size="sm" onClick={addOption} disabled={disabled}>
              <Plus className="h-4 w-4" /> {subjective ? "Add answer" : "Add choice"}
            </Button>
          </div>

          {subjective ? (
            <p className="text-xs text-muted-foreground">
              A response is marked correct when it matches one of these answers. Use commas for keywords, e.g.
              &quot;list, array&quot; — the response must contain every keyword.
            </p>
          ) : null}

          <div className="space-y-2">
            {question.options.map((option, optionIndex) => (
              <div key={option.key} className="flex items-center gap-2">
                <Button
                  type="button"
                  variant={option.isCorrect ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  disabled={disabled}
                  onClick={() => markCorrect(option.key)}
                  aria-label={`Mark answer ${optionIndex + 1} as correct`}
                  title={subjective ? "Accepted answer" : "Correct answer"}
                >
                  {option.isCorrect ? <Check className="h-4 w-4" /> : <span className="text-xs">{optionIndex + 1}</span>}
                </Button>
                <Input
                  value={option.label}
                  disabled={disabled}
                  onChange={(event) => updateOption(option.key, { label: event.target.value })}
                  placeholder={subjective ? "Expected answer" : `Choice ${optionIndex + 1}`}
                  aria-label={`${subjective ? "Expected answer" : "Choice"} ${optionIndex + 1}`}
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-9 w-9 shrink-0 text-red-600 hover:text-red-600"
                  disabled={disabled}
                  onClick={() => removeOption(option.key)}
                  aria-label="Remove answer"
                >
                  {question.options.length > 1 ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
                </Button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function BadgePill({ total }: { total: number }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      {total} pt{total === 1 ? "" : "s"}
    </span>
  );
}