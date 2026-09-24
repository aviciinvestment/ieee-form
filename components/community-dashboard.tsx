"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { usePortalEmail, usePortalSession } from "@/components/use-portal-auth";
import { RegistrationsTable } from "@/components/registrations-table";
import { Button } from "@/components/ui/button";
import type { Registration } from "@/lib/types";

const emailHeader = (email: string) => ({ "X-User-Email": email });

export function CommunityDashboard() {
  const portalEmail = usePortalEmail();
  const { state, logout } = usePortalSession(portalEmail);

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingReg, setLoadingReg] = useState(true);
  const [regError, setRegError] = useState("");
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
        setSubtitle(`View participant registrations to engage with the community — Track: ${d.track ?? "your track"}`);
      })
      .catch(() => {
        if (active) setSubtitle("View participant registrations to engage with the community.");
      });

    loadRegistrations();
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, portalEmail]);

  async function loadRegistrations() {
    if (!portalEmail) return;
    setLoadingReg(true);
    setRegError("");
    try {
      const res = await fetch("/api/registrations", { headers: emailHeader(portalEmail) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setRegistrations(data.data ?? []);
        setTotal(data.total ?? data.data?.length ?? 0);
      } else if (res.status === 401 || res.status === 403) {
        window.location.href = "/login";
        return;
      } else {
        setRegError(data.error || "Failed to load registrations.");
      }
    } catch {
      setRegError("Network error while loading registrations.");
    } finally {
      setLoadingReg(false);
    }
  }

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
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{total}</span> registration{total === 1 ? "" : "s"} in your track
          </p>
          <Button variant="outline" size="sm" onClick={loadRegistrations} disabled={loadingReg}>
            <RefreshCw className={`h-4 w-4 ${loadingReg ? "animate-spin" : ""}`} /> Refresh
          </Button>
        </div>

        {loadingReg ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading registrations…
          </p>
        ) : regError ? (
          <p className="text-sm text-red-600 dark:text-red-400">{regError}</p>
        ) : (
          <RegistrationsTable registrations={registrations} />
        )}
      </div>
    </DashboardShell>
  );
}