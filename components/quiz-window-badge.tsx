"use client";

import { CalendarClock, Lock, Unlock } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatWindowBound, quizWindowState, type QuizWindow } from "@/lib/quiz-window";
import { cn } from "@/lib/utils";

type Props = {
  window: QuizWindow;
  /**
   * An open quiz with no bounds set has nothing to announce, so the badge hides itself. Portal
   * views flip this on because a manager needs to see the state of every quiz at a glance.
   */
  alwaysShow?: boolean;
  className?: string;
};

/** Compact label for whether a quiz is open, still upcoming, or already closed. */
export function QuizWindowBadge({ window, alwaysShow = false, className }: Props) {
  const state = quizWindowState(window);

  if (state === "open" && !alwaysShow && !window.opensAt && !window.closesAt) return null;

  if (state === "upcoming") {
    return (
      <Badge variant="secondary" className={className} title={`Opens ${formatWindowBound(window.opensAt)}`}>
        <CalendarClock className="h-3 w-3" /> Opens {formatWindowBound(window.opensAt)}
      </Badge>
    );
  }

  if (state === "closed") {
    return (
      <Badge variant="destructive" className={className} title={`Closed ${formatWindowBound(window.closesAt)}`}>
        <Lock className="h-3 w-3" /> Closed {formatWindowBound(window.closesAt)}
      </Badge>
    );
  }

  return (
    <Badge
      variant="outline"
      className={cn(className, "border-green-600/40 text-green-700 dark:text-green-400")}
      title={window.closesAt ? `Open until ${formatWindowBound(window.closesAt)}` : "Open with no closing time"}
    >
      <Unlock className="h-3 w-3" />
      {window.closesAt ? `Open until ${formatWindowBound(window.closesAt)}` : "Open now"}
    </Badge>
  );
}

/** One line explaining the window to a participant who cannot start the quiz yet, or any more. */
export function quizWindowNotice(window: QuizWindow): string | null {
  const state = quizWindowState(window);
  if (state === "upcoming") return `Opens ${formatWindowBound(window.opensAt)}.`;
  if (state === "closed") return `Closed on ${formatWindowBound(window.closesAt)}.`;
  if (window.closesAt) return `Open until ${formatWindowBound(window.closesAt)}.`;
  return null;
}
