"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Award, CheckCircle2, ClipboardList, ExternalLink, Loader2, LogOut, UserCheck } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { AuthSignIn } from "@/components/auth-sign-in";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { getAuthHeaders } from "@/lib/firebase";

type ParticipantInfo = {
  firstName: string;
  lastName: string;
  email: string;
  trackName: string;
};

export function UserPortalLogin() {
  const [email, setEmail] = useState<string | null>(null);
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [notRegistered, setNotRegistered] = useState(false);
  const [error, setError] = useState("");

  // Restore saved participant email from localStorage if available
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem("participant_email");
      if (saved && saved.includes("@")) {
        setEmail(saved.toLowerCase());
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!email) {
      setParticipant(null);
      setNotRegistered(false);
      setError("");
      return;
    }

    try {
      window.localStorage.setItem("participant_email", email);
    } catch {
      /* ignore */
    }

    setLoading(true);
    setNotRegistered(false);
    setError("");

    let active = true;

    void (async () => {
      try {
        const headers = await getAuthHeaders();
        if (!active) return;

        const res = await fetch("/api/quizzes/available", { headers });
        const json = await res.json().catch(() => ({}));
        if (!active) return;

        if (res.status === 403 || json.error?.includes("not registered")) {
          setNotRegistered(true);
          setParticipant(null);
        } else if (res.ok && json.data?.participant) {
          setParticipant(json.data.participant);
        } else {
          // Fallback check to certificate endpoint
          const certRes = await fetch("/api/certificate", { headers });
          const certJson = await certRes.json().catch(() => ({}));
          if (!active) return;
          if (certRes.ok && certJson.participant) {
            setParticipant({
              firstName: certJson.participant.firstName,
              lastName: certJson.participant.lastName,
              email: certJson.participant.email,
              trackName: certJson.participant.techSkill,
            });
          } else if (certRes.status === 403 || certJson.error?.includes("not registered")) {
            setNotRegistered(true);
          } else {
            setError(json.error || certJson.error || "Could not retrieve participant information.");
          }
        }
      } catch {
        if (active) setError("Network error checking participant registration.");
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [email]);

  function handleSignOut() {
    try {
      window.localStorage.removeItem("participant_email");
    } catch {
      /* ignore */
    }
    setEmail(null);
    setParticipant(null);
    setNotRegistered(false);
    setError("");
  }

  return (
    <div className="w-full max-w-4xl mx-auto px-4 py-12 space-y-8">
      {/* Header */}
      <div className="text-center space-y-3">
        <AppLogo size={72} />
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          <UserCheck className="w-4 h-4" /> Participant Portal
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Welcome to the <span className="text-primary">Participant Portal</span>
        </h1>
        <p className="max-w-xl mx-auto text-sm md:text-base text-muted-foreground leading-relaxed">
          Sign in with your registered Gmail address to take your learning track quizzes and access your official
          Certificate of Achievement.
        </p>
      </div>

      {/* Main Authentication Area */}
      {!email ? (
        <Card className="glass-card max-w-lg mx-auto border-primary/20 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Sign In with your Gmail</CardTitle>
            <CardDescription className="leading-relaxed">
              Use the Google account you registered with to access your quizzes and certificate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <AuthSignIn
              verificationLabel="Verify your Gmail address to access your participant dashboard"
              onVerifiedEmail={(v) => setEmail(v.toLowerCase())}
              onSessionLost={handleSignOut}
            />
          </CardContent>
          <CardFooter className="flex justify-center border-t border-border/50 pt-4 text-xs text-muted-foreground">
            <span>Haven&apos;t joined the challenge yet?{" "}</span>
            <Link href="/" className="ml-1 text-primary underline underline-offset-4 hover:text-primary/80">
              Register now
            </Link>
          </CardFooter>
        </Card>
      ) : loading ? (
        <Card className="glass-card max-w-md mx-auto p-8 text-center">
          <div className="flex flex-col items-center justify-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm font-medium">Verifying your participant registration…</p>
            <p className="text-xs text-muted-foreground">{email}</p>
          </div>
        </Card>
      ) : notRegistered ? (
        <Card className="glass-card max-w-lg mx-auto border-amber-500/40 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-xl text-amber-500 flex items-center justify-center gap-2">
              Registration Not Found
            </CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              The email <strong className="text-foreground">{email}</strong> is not registered for the IEEE 30 Days Skill Challenge yet.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-xs text-muted-foreground text-center">
              Please complete the free 30-day challenge registration form first using this email address.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 justify-center">
              <Button asChild className="bg-primary text-primary-foreground">
                <Link href="/">Go to Registration Form</Link>
              </Button>
              <Button variant="outline" onClick={handleSignOut}>
                <LogOut className="mr-1.5 h-4 w-4" /> Sign In with Different Email
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        /* Authenticated Participant Hub */
        <div className="space-y-6">
          {/* Profile Card */}
          <Card className="glass-card border-primary/30 shadow-md">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0" />
                  <h3 className="text-lg font-bold">
                    {participant?.firstName} {participant?.lastName}
                  </h3>
                  {participant?.trackName ? (
                    <Badge variant="secondary" className="bg-primary/15 text-primary border-primary/30 text-xs">
                      {participant.trackName} Track
                    </Badge>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">{email}</p>
              </div>

              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="self-start sm:self-center text-xs"
              >
                <LogOut className="mr-1.5 h-3.5 w-3.5" /> Sign Out
              </Button>
            </CardContent>
          </Card>

          {/* Action Cards Grid: Quiz & Certificate */}
          <div className="grid gap-6 md:grid-cols-2">
            {/* 1. Track Quizzes Card */}
            <Card className="glass-card hover:border-primary/50 transition-all shadow-lg flex flex-col justify-between">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary w-fit">
                    <ClipboardList className="h-6 w-6" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Evaluations
                  </Badge>
                </div>
                <CardTitle className="text-xl">Track Quizzes</CardTitle>
                <CardDescription className="leading-relaxed text-sm">
                  Access all quizzes and challenges published for your{" "}
                  <strong className="text-foreground">{participant?.trackName || "assigned"}</strong> track. Submit
                  your answers and view your review results.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button asChild className="w-full bg-primary hover:bg-primary/90 text-primary-foreground gap-2">
                  <Link href="/quiz">
                    Open Track Quizzes <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>

            {/* 2. Certificate Card */}
            <Card className="glass-card hover:border-primary/50 transition-all shadow-lg flex flex-col justify-between">
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="p-2.5 rounded-lg bg-primary/10 text-primary w-fit">
                    <Award className="h-6 w-6" />
                  </div>
                  <Badge variant="outline" className="text-xs">
                    Official Award
                  </Badge>
                </div>
                <CardTitle className="text-xl">Certificate of Achievement</CardTitle>
                <CardDescription className="leading-relaxed text-sm">
                  Check if your completion has been approved by your track manager or administrator. View and download
                  your luxury dark certificate in high-res PNG or PDF.
                </CardDescription>
              </CardHeader>
              <CardFooter className="pt-2">
                <Button asChild variant="outline" className="w-full border-primary/40 hover:bg-primary/10 gap-2">
                  <Link href="/certificate">
                    Access Certificate <ExternalLink className="h-4 w-4" />
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </div>
        </div>
      )}

      {/* When not logged in, also show feature preview cards */}
      {!email ? (
        <div className="grid gap-6 md:grid-cols-2 pt-4">
          <Card className="glass-card border-border/60">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-semibold text-base">
                <ClipboardList className="h-5 w-5" /> Track Quizzes
              </div>
              <CardDescription className="text-xs leading-relaxed">
                Registered participants can take track assessments with automated scoring and manager reviews.
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="glass-card border-border/60">
            <CardHeader className="space-y-1">
              <div className="flex items-center gap-2 text-primary font-semibold text-base">
                <Award className="h-5 w-5" /> Certificate of Achievement
              </div>
              <CardDescription className="text-xs leading-relaxed">
                Approved participants can claim and download their official personalized certificate.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {/* Footer Navigation */}
      <div className="text-center pt-4 space-y-2 text-xs text-muted-foreground">
        <div>
          <span>Are you a community manager or administrator?{" "}</span>
          <Link href="/login" className="text-primary underline underline-offset-4 hover:text-primary/80">
            Go to Staff Login
          </Link>
        </div>
      </div>
    </div>
  );
}
