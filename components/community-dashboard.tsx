"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { usePortalEmail, usePortalSession } from "@/components/use-portal-auth";
import { RegistrationsManager } from "@/components/registrations-manager";
import { QuizManager } from "@/components/quiz-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

const emailHeader = (email: string) => ({ "X-User-Email": email });

export function CommunityDashboard() {
  const portalEmail = usePortalEmail();
  const { state, logout } = usePortalSession(portalEmail);

  const [trackName, setTrackName] = useState("");
  const [checkedRole, setCheckedRole] = useState(false);
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
        setCheckedRole(true);
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
        {portalEmail && trackName === "" ? (
          checkedRole ? (
            <Card className="border-amber-500/50">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg">
                  <AlertTriangle className="h-5 w-5 text-amber-600" /> No track assigned yet
                </CardTitle>
                <CardDescription>
                  Your account is a community manager, but no learning track has been assigned to it yet. Until the
                  admin assigns a track there is nothing to show, because every registration and quiz is scoped to one
                  track.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Ask the admin to set your track on the admin dashboard, then reload this page.
                </p>
                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => window.location.reload()}>Reload</Button>
                  <Button variant="outline" onClick={logout}>
                    Sign out
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <p className="text-sm text-muted-foreground">Loading your track…</p>
          )
        ) : null}

        {portalEmail && trackName ? (
          <>
            <RegistrationsManager
              email={portalEmail}
              tracks={[trackName]}
              lockedTrack={trackName}
              emptyMessage="No participants match your filters in your track yet."
            />
            <QuizManager email={portalEmail} trackOptions={[trackName]} lockedTrack={trackName} />
          </>
        ) : null}
      </div>
    </DashboardShell>
  );
}