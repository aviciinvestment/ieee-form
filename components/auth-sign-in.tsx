"use client";

import { useEffect, useState } from "react";
import {
  isSignInWithEmailLink,
  onAuthStateChanged,
  sendSignInLinkToEmail,
  signInWithEmailLink,
  signInWithPopup,
  signOut,
} from "firebase/auth";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useFirebaseAccount } from "@/components/use-firebase";
import type { AuthStatus } from "@/lib/types";

const isGmail = (email: string) => email.trim().toLowerCase().endsWith("@gmail.com");

type Props = {
  onVerifiedEmail: (email: string) => void;
  onSessionLost: () => void;
  verificationLabel?: string;
};

export function AuthSignIn({ onVerifiedEmail, onSessionLost, verificationLabel }: Props) {
  const { fb, loadError } = useFirebaseAccount();
  const [emailInput, setEmailInput] = useState("");
  const [status, setStatus] = useState<AuthStatus>({ text: "", kind: "info" });
  const [busy, setBusy] = useState(false);
  const [helpLink, setHelpLink] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetch("/api/settings/support")
      .then((r) => r.json().catch(() => ({})))
      .then((d) => {
        if (active && d?.whatsappLink) setHelpLink(d.whatsappLink);
      })
      .catch(() => {
        /* support link optional */
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!fb) return;
    const unsub = onAuthStateChanged(fb.auth, async (user) => {
      if (!user || !user.email) {
        onSessionLost();
        return;
      }
      if (user.emailVerified || isGmail(user.email)) {
        setStatus({ text: `Verified as ${user.email}. Ready to continue.`, kind: "success" });
        onVerifiedEmail(user.email);
      } else {
        try {
          await signOut(fb.auth);
        } catch {
          /* noop */
        }
        setStatus({ text: "Only verified Gmail accounts are allowed.", kind: "error" });
        onSessionLost();
      }
    });
    return () => unsub();
  }, [fb, onVerifiedEmail, onSessionLost]);

  useEffect(() => {
    if (!fb || typeof window === "undefined") return;
    const href = window.location.href;
    if (!isSignInWithEmailLink(fb.auth, href)) return;

    let email = window.localStorage.getItem("portal_email_for_sign_in") || "";
    if (!email) {
      const typed = window.prompt("Please confirm your Gmail address for verification:");
      if (!typed) return;
      email = typed;
    }
    if (!isGmail(email)) {
      setStatus({ text: "Only Gmail addresses are allowed.", kind: "error" });
      return;
    }
    signInWithEmailLink(fb.auth, email, href)
      .then(() => {
        window.localStorage.removeItem("portal_email_for_sign_in");
      })
      .catch((err: unknown) => {
        setStatus({ text: friendlyError(err), kind: "error" });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fb]);

  async function handleGoogle() {
    if (!fb) return;
    setBusy(true);
    setStatus({ text: "Signing you in with Google…", kind: "info" });
    try {
      const result = await signInWithPopup(fb.auth, fb.provider);
      const user = result.user;
      if (!user.email || !isGmail(user.email)) {
        await signOut(fb.auth);
        setStatus({ text: "Only Gmail addresses are permitted.", kind: "error" });
        onSessionLost();
        return;
      }
      setStatus({ text: `Signed in as ${user.email}.`, kind: "success" });
      onVerifiedEmail(user.email);
    } catch (err) {
      setStatus({ text: friendlyError(err), kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  async function handleMagicLink() {
    if (!fb) return;
    const email = emailInput.trim();
    if (!email) {
      setStatus({ text: "Please enter your Gmail address first.", kind: "error" });
      return;
    }
    if (!isGmail(email)) {
      setStatus({ text: "Only Gmail addresses are permitted.", kind: "error" });
      return;
    }
    setBusy(true);
    setStatus({ text: "Sending verification link…", kind: "info" });
    try {
      await sendSignInLinkToEmail(fb.auth, email, {
        url: window.location.href,
        handleCodeInApp: true,
      });
      window.localStorage.setItem("portal_email_for_sign_in", email);
      setStatus({
        text: `Verification link sent to ${email}. Please check your inbox (and spam folder).`,
        kind: "success",
      });
    } catch (err) {
      setStatus({ text: friendlyError(err), kind: "error" });
    } finally {
      setBusy(false);
    }
  }

  if (loadError) {
    return <p className="text-sm text-red-600 dark:text-red-400">{loadError}</p>;
  }

  return (
    <div className="space-y-4">
      {verificationLabel ? (
        <p className="text-sm text-muted-foreground">{verificationLabel}</p>
      ) : null}

      <Button
        type="button"
        variant="default"
        size="lg"
        className="w-full gap-2"
        onClick={handleGoogle}
        disabled={!fb || busy}
      >
        {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <GoogleIcon />}
        Continue with Google
      </Button>

      <div className="relative">
        <div className="absolute inset-0 flex items-center">
          <span className="w-full border-t" />
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-background px-2 text-muted-foreground">or</span>
        </div>
      </div>

      <div className="space-y-2">
        <Input
          type="email"
          placeholder="Enter your Gmail address…"
          value={emailInput}
          onChange={(e) => setEmailInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              handleMagicLink();
            }
          }}
          disabled={!fb || busy}
          autoComplete="email"
        />
        <Button type="button" variant="outline" className="w-full" onClick={handleMagicLink} disabled={!fb || busy}>
          Send magic link
        </Button>
      </div>

      {status.text ? (
        <p
          className={`text-sm flex items-start gap-2 ${
            status.kind === "success"
              ? "text-green-700 dark:text-green-400"
              : status.kind === "error"
                ? "text-red-600 dark:text-red-400"
                : "text-muted-foreground"
          }`}
        >
          {status.kind === "success" ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
          ) : null}
          {status.text}
        </p>
      ) : null}

      <p className="text-xs text-muted-foreground">
        By continuing you agree to use your real Gmail address.
        {helpLink ? (
          <>
            {" "}
            <a
              href={helpLink}
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 text-primary"
            >
              Need help?
            </a>
          </>
        ) : null}
      </p>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function friendlyError(err: unknown): string {
  const code = (err as { code?: string })?.code;
  if (code === "auth/popup-blocked") return "The Google sign-in popup was blocked. Please allow popups for this site and try again.";
  if (code === "auth/popup-closed-by-user") return "The sign-in popup was closed before completing verification.";
  if (code === "auth/email-already-in-use") return "This Gmail address is already in use with another provider.";
  if (code === "auth/invalid-action-code") return "The verification link has expired. Please request a new one.";
  if (code === "auth/too-many-requests") return "Too many verification attempts. Please wait a few minutes and try again.";
  return (err as { message?: string })?.message ?? "An unexpected authentication error occurred.";
}