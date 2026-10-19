"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { Award, Clock, ArrowLeft, RefreshCw, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { AppLogo } from "@/components/app-logo";
import { AuthSignIn } from "@/components/auth-sign-in";
import { CertificateViewer } from "@/components/certificate-viewer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CertificateTemplate } from "@/lib/types";
import { getAuthHeaders } from "@/lib/firebase";

type ParticipantData = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  techSkill: string;
  approvedAt?: string | null;
};

type CertificateResponse = {
  eligible: boolean;
  participant?: ParticipantData;
  template?: CertificateTemplate;
  message?: string;
  error?: string;
};

export function CertificatePortal() {
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<CertificateResponse | null>(null);
  const [error, setError] = useState("");

  const loadCertificate = useCallback(async (userEmail: string) => {
    setLoading(true);
    setError("");
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/certificate", {
        headers,
      });
      const data = (await res.json().catch(() => ({}))) as CertificateResponse;
      if (!res.ok) {
        setError(data.error || "Could not retrieve certificate information.");
        setResult(null);
      } else {
        setResult(data);
      }
    } catch {
      setError("Network error while verifying certificate eligibility.");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (email) {
      void loadCertificate(email);
    } else {
      setResult(null);
    }
  }, [email, loadCertificate]);

  return (
    <div className="w-full max-w-5xl mx-auto px-4 py-10 pb-28 space-y-8">
      {/* Top Header */}
      <div className="flex flex-col items-center text-center space-y-3">
        <AppLogo />
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold uppercase tracking-wider">
          <Award className="w-4 h-4" /> Official Certificate Portal
        </div>
        <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight">
          Claim Your <span className="text-primary">Certificate</span>
        </h1>
        <p className="max-w-xl text-sm md:text-base text-muted-foreground">
          Participants approved by the manager or administrator can access, view, and download their official Certificate of Achievement.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs text-muted-foreground">
          <Link
            href="/user/login"
            className="hover:text-primary underline underline-offset-4 transition-colors font-medium text-foreground"
          >
            ← Participant Portal
          </Link>
          <span>•</span>
          <Link
            href="/quiz"
            className="hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Track Quizzes
          </Link>
          <span>•</span>
          <Link
            href="/"
            className="hover:text-foreground underline underline-offset-4 transition-colors"
          >
            Registration Form
          </Link>
        </div>
      </div>

      {/* Main Content Card or Sign-In */}
      {!email ? (
        <Card className="glass-card max-w-xl mx-auto border-primary/20 shadow-xl">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Verify your Gmail</CardTitle>
            <CardDescription>
              Sign in with the Gmail address you registered with to check your approval status and access your certificate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AuthSignIn
              onVerifiedEmail={(verified) => setEmail(verified)}
              onSessionLost={() => setEmail(null)}
              verificationLabel="Verify Gmail to get Certificate"
            />
          </CardContent>
        </Card>
      ) : loading ? (
        <div className="flex flex-col items-center justify-center py-16 space-y-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm font-medium">Checking your certificate status…</p>
        </div>
      ) : error ? (
        <Card className="glass-card max-w-xl mx-auto border-destructive/40">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-destructive text-lg">
              <AlertCircle className="w-5 h-5" /> Not Found
            </CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent className="flex justify-between items-center">
            <Button variant="outline" size="sm" onClick={() => setEmail(null)}>
              Change email
            </Button>
            <Button size="sm" onClick={() => loadCertificate(email)}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Try again
            </Button>
          </CardContent>
        </Card>
      ) : result?.eligible && result.participant && result.template ? (
        /* Approved Certificate View */
        <div className="space-y-6">
          {/* Status Banner */}
          <div className="flex flex-wrap items-center justify-between gap-4 p-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-emerald-950 dark:text-emerald-200">
                  Certificate Approved & Ready!
                </h3>
                <p className="text-xs text-emerald-800/80 dark:text-emerald-300/80">
                  Issued to <strong className="font-semibold">{result.participant.firstName} {result.participant.lastName}</strong> for the <strong>{result.participant.techSkill}</strong> track.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Badge variant="outline" className="border-emerald-500/40 text-emerald-700 dark:text-emerald-300">
                {email}
              </Badge>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setEmail(null)}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Sign out
              </Button>
            </div>
          </div>

          {/* Certificate Canvas / Component */}
          <CertificateViewer
            participant={result.participant}
            template={result.template}
            showDownloadButtons={true}
          />
        </div>
      ) : (
        /* Pending Approval View */
        <Card className="glass-card max-w-xl mx-auto border-amber-500/40 shadow-xl">
          <CardHeader className="text-center space-y-2">
            <div className="mx-auto p-3 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 w-fit">
              <Clock className="w-8 h-8 animate-pulse" />
            </div>
            <CardTitle className="text-xl font-bold">Certificate Pending Approval</CardTitle>
            <CardDescription className="text-sm leading-relaxed">
              {result?.message ||
                "Your registration is active, but your certificate has not been approved by your track manager or administrator yet."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {result?.participant ? (
              <div className="p-3.5 rounded-lg bg-background/60 border border-border/60 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Candidate:</span>
                  <span className="font-medium">{result.participant.firstName} {result.participant.lastName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Learning Track:</span>
                  <span className="font-medium">{result.participant.techSkill}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-semibold text-amber-600 dark:text-amber-400">Awaiting Manager / Admin Approval</span>
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-3 pt-2">
              <Button variant="outline" size="sm" onClick={() => setEmail(null)}>
                Sign out
              </Button>
              <Button size="sm" onClick={() => loadCertificate(email)}>
                <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Check again
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
