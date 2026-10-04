"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { usePortalEmail, usePortalSession } from "@/components/use-portal-auth";
import { RegistrationsManager } from "@/components/registrations-manager";
import { QuizManager } from "@/components/quiz-manager";

const emailHeader = (email: string) => ({ "X-User-Email": email });

export function CommunityDashboard() {
  const portalEmail = usePortalEmail();
  const { state, logout } = usePortalSession(portalEmail);

  const [trackName, setTrackName] = useState("");
  const [subtitle, setSubtitle] = useState("Loading your community…");

  useEffect(() => {
    if (state !== "granted" || !portalEmail) return;

    let active = true;
    fetch("/api/auth/role", { headers: emailHeader(portalEmail) })
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        if (d.role !== "manager") {
          window.location.href = "/login";
          return;
        }
        setTrackName(d.track ?? "");
        setSubtitle(
          `Search, add, update and remove the participants in your track, and publish quizzes${
            d.track ? ` — ${d.track}` : ""
          }`
        );
      })
      .catch(() => {
        if (active) setSubtitle("Search, add, update and remove the participants in your track, and publish quizzes.");
      });

    return () => {
      active = false;
    };
  }, [state, portalEmail]);

  if (state === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" /> Verifying your session…
        </p>
      </div>
    );
  }
  if (state === "denied") {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">Redirecting to login…</p>
      </div>
    );
  }

  return (
    <DashboardShell title="COMMUNITY MANAGER" subtitle={subtitle} onLogout={logout}>
      <div className="space-y-6">
        {portalEmail ? (
          <>
            <RegistrationsManager
              email={portalEmail}
              tracks={trackName ? [trackName] : []}
              lockedTrack={trackName || undefined}
              emptyMessage="No participants match your filters in your track yet."
            />
            <QuizManager
              email={portalEmail}
              trackOptions={trackName ? [trackName] : []}
              lockedTrack={trackName || undefined}
            />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Loading your session…</p>
        )}
      </div>
    </DashboardShell>
  );
}