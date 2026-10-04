import type { REGISTRATION_SEARCH_FIELDS, REGISTRATION_SORT_FIELDS } from "@/lib/registrations";

export type Registration = {
  id: string;
  firstName: string;
  lastName: string;
  phone: string;
  techSkill: string;
  email: string;
  createdAt: string;
};

export type RegistrationSortField = (typeof REGISTRATION_SORT_FIELDS)[number];
export type RegistrationSearchField = (typeof REGISTRATION_SEARCH_FIELDS)[number];
export type SortOrder = "asc" | "desc";

export type RegistrationFormValues = {
  firstName: string;
  lastName: string;
  phone: string;
  techSkill: string;
  email: string;
};

export type LearningTrack = {
  id: string;
  name: string;
  whatsappLink: string;
  createdAt: string;
  updatedAt: string;
};

export type CommunityManager = {
  id: string;
  email: string;
  trackName: string;
  createdAt: string;
};

export type AuthStatus = { text: string; kind: "info" | "success" | "error" };

export type QuestionKind = "OBJECTIVE" | "SHORT_TEXT" | "LONG_TEXT";

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  OBJECTIVE: "Objective (multiple choice)",
  SHORT_TEXT: "Subjective (short answer)",
  LONG_TEXT: "Subjective (long answer)",
};

export const QUESTION_TYPE_VALUES: QuestionKind[] = ["OBJECTIVE", "SHORT_TEXT", "LONG_TEXT"];

export type QuizSummary = {
  id: string;
  title: string;
  description: string;
  trackName: string;
  published: boolean;
  questionCount: number;
  totalPoints: number;
  attemptCount: number;
  createdAt: string;
  updatedAt: string;
};

export type QuizDetail = {
  id: string;
  title: string;
  description: string;
  trackName: string;
  published: boolean;
  attemptCount: number;
  locked: boolean;
  questions: {
    id: string;
    prompt: string;
    type: QuestionKind;
    points: number;
    explanation: string;
    order: number;
    referenceFileUrl?: string;
    referenceFilePages?: number;
    referenceFileText?: string;
    options: { id: string; label: string; isCorrect: boolean }[];
  }[];
};

export type OptionDraft = { key: string; id?: string; label: string; isCorrect: boolean };

export type QuestionDraft = {
  key: string;
  id?: string;
  prompt: string;
  type: QuestionKind;
  points: number;
  explanation: string;
  options: OptionDraft[];
  /** Cloudinary link to a reference PDF for this subjective question. */
  referenceFileUrl: string;
  /** Pages the AI will analyse in that PDF. */
  referenceFilePages: number;
  /** Name shown in the editor, kept locally so the manager recognises the file. */
  referenceFileName: string;
  /** Text extracted from the reference PDF, sent with the quiz so the AI can read it. */
  referenceFileText: string;
};

export type QuizDraft = {
  id: string | null;
  title: string;
  description: string;
  published: boolean;
  trackName: string;
  questions: QuestionDraft[];
};

export type GradingMethod = "RULES" | "EMBEDDING" | "AI";
export type ResultStatus = "PENDING_REVIEW" | "PUBLISHED";

export const GRADING_METHOD_LABELS: Record<GradingMethod, string> = {
  RULES: "Exact match",
  EMBEDDING: "Embedding similarity (no longer used)",
  AI: "AI evaluation",
};

export type GradedAnswerView = {
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
  gradedBy: GradingMethod;
  similarity: number | null;
  aiScore: number | null;
  aiReason: string;
  aiModel: string;
};

export type AttemptResultView = {
  attemptId: string;
  submittedAt: string;
  score: number;
  maxScore: number;
  percentage: number;
  resultStatus: ResultStatus;
  publishedAt: string | null;
  answers: GradedAnswerView[];
};

export type AvailableQuiz = {
  id: string;
  title: string;
  description: string;
  trackName: string;
  questionCount: number;
  totalPoints: number;
  objectiveCount: number;
  subjectiveCount: number;
  createdAt: string;
  attempt: {
    id: string;
    submittedAt: string;
    resultStatus: ResultStatus;
    publishedAt: string | null;
    score: number | null;
    maxScore: number | null;
    percentage: number | null;
  } | null;
};

export type TakeQuestion = {
  id: string;
  prompt: string;
  type: QuestionKind;
  points: number;
  order: number;
  referenceFileUrl?: string;
  referenceFilePages?: number;
  options: { id: string; label: string }[];
};

export type QuizAttemptSummary = {
  id: string;
  participantEmail: string;
  participantName: string;
  trackName: string;
  score: number;
  maxScore: number;
  percentage: number;
  submittedAt: string;
  resultStatus: ResultStatus;
  publishedAt: string | null;
  publishedBy: string | null;
  adjustedScore: number | null;
  adjustedMaxScore: number | null;
  adjustedFeedback: string;
  answers: {
    questionId: string;
    responseText: string;
    responseFileUrl?: string;
    responseFilePages?: number;
    selectedOptionId: string | null;
    isCorrect: boolean;
    pointsAwarded: number;
    gradedBy: GradingMethod;
    similarity: number | null;
    aiScore: number | null;
    aiReason: string;
    aiModel: string;
  }[];
};