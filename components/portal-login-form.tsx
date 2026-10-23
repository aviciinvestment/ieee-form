"use client";

import { useEffect, useState } from "react";
import { AuthSignIn } from "@/components/auth-sign-in";
import { getAuthHeaders } from "@/lib/firebase";

type Props = {
  requiredRole: "admin" | "manager";
  redirectPath: string;
};

export function PortalLoginForm({ requiredRole, redirectPath }: Props) {
  const [verifiedEmail, setVerifiedEmail] = useState<string | null>(null);
  const [status, setStatus] = useState<{ text: string; kind: "info" | "success" | "error" }>({
    text: "",
    kind: "info",
  });
  const [checking, setChecking] = useState(false);

  useEffect(() => {
    if (!verifiedEmail) return;
    setChecking(true);
    let active = true;

    void (async () => {
      try {
        const headers = await getAuthHeaders();
        const res = await fetch("/api/auth/role", { headers });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.ok && data.role === requiredRole) {
          try {
            window.localStorage.setItem("portal_email", verifiedEmail);
          } catch {
            /* noop */
          }
          setStatus({ text: "Access granted. Redirecting…", kind: "success" });
          window.location.href = redirectPath;
        } else {
          const label = requiredRole === "admin" ? "an admin" : "a community manager";
          setStatus({ text: `You are not authorized as ${label}. Please contact the administrator.`, kind: "error" });
        }
        setChecking(false);
      } catch {
        if (!active) return;
        setStatus({ text: "Could not verify your access. Please try again.", kind: "error" });
        setChecking(false);
      }
    })();

    return () => {
      active = false;
    };
  }, [verifiedEmail, requiredRole, redirectPath]);

  return (
    <div className="space-y-4">
      <AuthSignIn
        verificationLabel={
          requiredRole === "admin"
            ? "Sign in with the admin Gmail account to manage the challenge."
            : "Sign in with your verified Gmail address to manage your community track."
        }
        onVerifiedEmail={(email) => setVerifiedEmail(email.toLowerCase())}
        onSessionLost={() => setVerifiedEmail(null)}
      />
      {status.text ? (
        <div className="space-y-2">
          <p
            className={`text-sm flex items-start gap-2 ${
              status.kind === "success"
                ? "text-green-700 dark:text-green-400"
                : status.kind === "error"
                  ? "text-red-600 dark:text-red-400"
                  : "text-muted-foreground"
            }`}
          >
            {status.text}
          </p>
          {status.kind === "error" ? (
            <button
              type="button"
              onClick={async () => {
                const { signOutFirebase } = await import("@/lib/firebase");
                await signOutFirebase();
                setVerifiedEmail(null);
                setStatus({ text: "", kind: "info" });
              }}
              className="text-xs text-primary underline underline-offset-4 hover:opacity-80 transition-opacity"
            >
              Sign out and try another Gmail account →
            </button>
          ) : null}
        </div>
      ) : null}
      {checking ? <p className="text-sm text-muted-foreground">&hellip; verifying your access</p> : null}
    </div>
  );
}