"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, ClipboardList, Clock, Loader2, RefreshCw } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { AuthSignIn } from "@/components/auth-sign-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import type { AvailableQuiz } from "@/lib/types";

const emailHeader = (email: string) => ({ "X-User-Email": email });

export function QuizCenter() {
  const [email, setEmail] = useState<string | null>(null);
  const [participant, setParticipant] = useState<{ firstName: string; lastName: string; email: string; trackName: string } | null>(
    null
  );
  const [quizzes, setQuizzes] = useState<AvailableQuiz[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const load = useCallback(async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const res = await fetch("/api/quizzes/available", { headers: emailHeader(email) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setQuizzes([]);
        setParticipant(null);
        setError(data.error || "Could not load your quizzes.");
        return;
      }
      setParticipant(data.data.participant);
      setQuizzes(data.data.quizzes ?? []);
    } catch {
      setError("Network error while loading your quizzes.");
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return quizzes;
    return quizzes.filter((quiz) => quiz.title.toLowerCase().includes(term));
  }, [quizzes, search]);

  return (
    <div className="w-full max-w-3xl mx-auto px-4 py-10">
      <div className="text-center mb-8">
        <AppLogo />
        <h1 className="mt-4 text-3xl font-bold tracking-tight md:text-4xl">
          Track <em className="text-primary not-italic font-extrabold">Quizzes</em>
        </h1>
        <p className="mt-2 text-muted-foreground">
          Verify your Gmail to see the quizzes published for your learning track. Your answers are graded
          automatically, then a community manager reviews the result before you can see your score.
        </p>
      </div>

      {!email ? (
        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-xl">Verify your Gmail</CardTitle>
            <CardDescription>
              Only registered participants can take a quiz, and only the quizzes for their own track.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthSignIn onVerifiedEmail={setEmail} onSessionLost={() => setEmail(null)} />
          </CardContent>
        </Card>
      ) : loading ? (
        <p className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading your quizzes…
        </p>
      ) : (
        <div className="space-y-4">
          <Card className="glass-card">
            <CardContent className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Signed in as</p>
                <p className="font-medium">{email}</p>
              </div>
              {participant ? (
                <Badge variant="secondary">Track: {participant.trackName}</Badge>
              ) : null}
              <Button variant="outline" size="sm" onClick={() => setReloadKey((key) => key + 1)}>
                <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} /> Refresh
              </Button>
            </CardContent>
          </Card>

          {error ? <p className="text-sm text-red-600 dark:text-red-400">{error}</p> : null}

          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your quizzes…"
            aria-label="Search quizzes"
          />

          {visible.length === 0 ? (
            <Card className="glass-card">
              <CardContent className="py-12 text-center text-sm text-muted-foreground">
                {quizzes.length === 0
                  ? "No quizzes have been published for your track yet. Check back soon."
                  : "No quizzes match your search."}
              </CardContent>
            </Card>
          ) : (
            <ul className="space-y-3">
              {visible.map((quiz) => (
                <li key={quiz.id}>
                  <Card className="glass-card">
                    <CardHeader>
                      <CardTitle className="text-lg">{quiz.title}</CardTitle>
                      {quiz.description ? <CardDescription>{quiz.description}</CardDescription> : null}
                    </CardHeader>
                    <CardContent className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                        <Badge variant="outline">{quiz.questionCount} questions</Badge>
                        <Badge variant="outline">{quiz.totalPoints} points</Badge>
                        {quiz.durationMinutes > 0 ? (
                          <Badge variant="outline" title="Your answers are submitted automatically when the time runs out">
                            <Clock className="h-3.5 w-3.5" /> {quiz.durationMinutes} min
                          </Badge>
                        ) : null}
                        {quiz.objectiveCount > 0 ? (
                          <Badge variant="secondary">{quiz.objectiveCount} objective</Badge>
                        ) : null}
                        {quiz.subjectiveCount > 0 ? (
                          <Badge variant="secondary">{quiz.subjectiveCount} written</Badge>
                        ) : null}
                      </div>

                      {quiz.attempt ? (
                        <div className="flex items-center gap-2">
                          {quiz.attempt.resultStatus === "PUBLISHED" ? (
                            <Badge
                              variant={
                                (quiz.attempt.percentage ?? 0) >= 50 ? "default" : "secondary"
                              }
                            >
                              <Award className="h-3.5 w-3.5" />
                              {quiz.attempt.score}/{quiz.attempt.maxScore} · {quiz.attempt.percentage}%
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <Clock className="h-3.5 w-3.5" /> Awaiting review
                            </Badge>
                          )}
                          <Button variant="outline" size="sm">
                            <Link href={`/quiz/${quiz.id}`}>
                              {quiz.attempt.resultStatus === "PUBLISHED" ? "View result" : "View status"}
                            </Link>
                          </Button>
                        </div>
                      ) : (
                        <Button size="sm">
                          <Link href={`/quiz/${quiz.id}`}>
                            <ClipboardList className="h-4 w-4" /> Start quiz
                          </Link>
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                </li>
              ))}
            </ul>
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Each quiz allows one attempt, and a timed quiz starts counting down the moment you open it. Your score
            stays private until a community manager publishes the result.
          </p>
        </div>
      )}
    </div>
  );
}