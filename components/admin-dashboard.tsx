"use client";

import { useEffect, useState } from "react";
import { Loader2, Plus, RefreshCw, Save, Trash2 } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { useAlert } from "@/components/use-alert";
import { usePortalEmail, usePortalSession } from "@/components/use-portal-auth";
import { RegistrationsTable } from "@/components/registrations-table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import type { CommunityManager, LearningTrack, Registration } from "@/lib/types";

const emailHeader = (email: string) => ({ "X-User-Email": email });

export function AdminDashboard() {
  const portalEmail = usePortalEmail();
  const { state, logout } = usePortalSession(portalEmail);
  const { showAlert, dialog } = useAlert();

  const [registrations, setRegistrations] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loadingReg, setLoadingReg] = useState(true);
  const [regError, setRegError] = useState("");

  const [managers, setManagers] = useState<CommunityManager[]>([]);
  const [newManagerEmail, setNewManagerEmail] = useState("");
  const [newManagerTrack, setNewManagerTrack] = useState("");
  const [managerBusy, setManagerBusy] = useState(false);

  const [tracks, setTracks] = useState<LearningTrack[]>([]);
  const [newTrackName, setNewTrackName] = useState("");
  const [newTrackLink, setNewTrackLink] = useState("");
  const [trackBusy, setTrackBusy] = useState(false);

  const [trackEdits, setTrackEdits] = useState<Record<string, { name: string; whatsappLink: string }>>({});
  const [managerTrackEdits, setManagerTrackEdits] = useState<Record<string, string>>({});

  const [subtitle, setSubtitle] = useState("View and manage all registered participants");

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

  async function loadManagers() {
    try {
      const res = await fetch("/api/managers", { headers: emailHeader(portalEmail) });
      const data = await res.json().catch(() => ({}));
      if (res.ok) setManagers(data.data ?? []);
    } catch {
      /* noop */
    }
  }

  async function loadTracks() {
    try {
      const res = await fetch("/api/tracks");
      const data = await res.json().catch(() => ({}));
      if (res.ok) setTracks(data.data ?? []);
    } catch {
      /* noop */
    }
  }

  useEffect(() => {
    if (state !== "granted" || !portalEmail) return;
    loadRegistrations();
    loadManagers();
    loadTracks();
    fetch("/api/auth/role", { headers: emailHeader(portalEmail) })
      .then((r) => r.json())
      .then((d) => {
        if (d.role !== "admin") {
          window.location.href = "/login";
        }
      })
      .catch(() => {
        /* noop */
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, portalEmail]);

  async function addManager() {
    if (!newManagerEmail.trim()) {
      showAlert("Missing email", "Please enter a Gmail address for the manager.");
      return;
    }
    setManagerBusy(true);
    try {
      const res = await fetch("/api/managers", {
        method: "POST",
        headers: { ...emailHeader(portalEmail), "Content-Type": "application/json" },
        body: JSON.stringify({ email: newManagerEmail.trim(), trackName: newManagerTrack || "" }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewManagerEmail("");
        await loadManagers();
        showAlert("Success", data.message || "Manager added successfully");
      } else {
        showAlert("Could not add manager", data.error || "Something went wrong.");
      }
    } catch {
      showAlert("Network error", "Could not add manager. Please try again.");
    } finally {
      setManagerBusy(false);
    }
  }

  async function updateManager(id: string, trackName: string) {
    if (!trackName) {
      showAlert("Missing track", "Select a learning track for this manager first.");
      return;
    }
    setManagerBusy(true);
    try {
      const res = await fetch(`/api/managers/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { ...emailHeader(portalEmail), "Content-Type": "application/json" },
        body: JSON.stringify({ trackName }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadManagers();
        showAlert("Success", data.message || "Manager track updated successfully");
      } else {
        showAlert("Could not update", data.error || "Something went wrong.");
      }
    } catch {
      showAlert("Network error", "Could not update manager. Please try again.");
    } finally {
      setManagerBusy(false);
    }
  }

  async function removeManager(email: string) {
    if (!window.confirm(`Remove ${email} as a community manager?`)) return;
    setManagerBusy(true);
    try {
      const res = await fetch(`/api/managers/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: emailHeader(portalEmail),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadManagers();
        showAlert("Success", data.message || "Manager removed successfully");
      } else {
        showAlert("Could not remove", data.error || "Something went wrong.");
      }
    } catch {
      showAlert("Network error", "Could not remove manager. Please try again.");
    } finally {
      setManagerBusy(false);
    }
  }

  async function addTrack() {
    if (!newTrackName.trim() || !newTrackLink.trim()) {
      showAlert("Missing details", "Track name and WhatsApp group link are required.");
      return;
    }
    setTrackBusy(true);
    try {
      const res = await fetch("/api/tracks", {
        method: "POST",
        headers: { ...emailHeader(portalEmail), "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTrackName.trim(), whatsappLink: newTrackLink.trim() }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setNewTrackName("");
        setNewTrackLink("");
        await loadTracks();
        await loadRegistrations();
        showAlert("Success", data.message || "Learning track added successfully");
      } else {
        showAlert("Could not add track", data.error || "Something went wrong.");
      }
    } catch {
      showAlert("Network error", "Could not add track. Please try again.");
    } finally {
      setTrackBusy(false);
    }
  }

  async function updateTrack(id: string) {
    const edit = trackEdits[id];
    if (!edit || !edit.name || !edit.whatsappLink) {
      showAlert("Missing details", "Track name and WhatsApp group link are required.");
      return;
    }
    setTrackBusy(true);
    try {
      const res = await fetch(`/api/tracks/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: { ...emailHeader(portalEmail), "Content-Type": "application/json" },
        body: JSON.stringify({ name: edit.name, whatsappLink: edit.whatsappLink }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadTracks();
        await loadRegistrations();
        showAlert("Success", data.message || "Learning track updated successfully");
      } else {
        showAlert("Could not update", data.error || "Something went wrong.");
      }
    } catch {
      showAlert("Network error", "Could not update track. Please try again.");
    } finally {
      setTrackBusy(false);
    }
  }

  async function deleteTrack(id: string) {
    if (!window.confirm("Delete this learning track?")) return;
    setTrackBusy(true);
    try {
      const res = await fetch(`/api/tracks/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: emailHeader(portalEmail),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        await loadTracks();
        showAlert("Success", data.message || "Learning track removed successfully");
      } else {
        showAlert("Could not delete", data.error || "Something went wrong.");
      }
    } catch {
      showAlert("Network error", "Could not delete track. Please try again.");
    } finally {
      setTrackBusy(false);
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

  const trackOptions = Array.from(new Set([...tracks.map((t) => t.name)]));

  return (
    <DashboardShell title="ADMIN DASHBOARD" subtitle={subtitle} onLogout={logout}>
      <div className="space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{total}</span> total registration{total === 1 ? "" : "s"}
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

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Manage Community Managers</CardTitle>
            <CardDescription>Add or remove community managers who can view the dashboard data.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                type="email"
                placeholder="Enter Gmail address…"
                value={newManagerEmail}
                onChange={(e) => setNewManagerEmail(e.target.value)}
                aria-label="Manager Gmail address"
              />
              <Select value={newManagerTrack} onValueChange={setNewManagerTrack}>
                <SelectTrigger aria-label="Select track">
                  <SelectValue placeholder="Select track" />
                </SelectTrigger>
                <SelectContent>
                  {trackOptions.map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={addManager} disabled={managerBusy} className="w-full">
                {managerBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
              </Button>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">
                Authorized Managers{" "}
                <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {managers.length}
                </span>
              </h4>
              <ul className="space-y-2">
                {managers.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No community managers yet.</li>
                ) : (
                  managers.map((m) => (
                    <li
                      key={m.id}
                      className="flex flex-col gap-2 rounded-md border border-border bg-background/60 p-3 sm:flex-row sm:items-center"
                    >
                      <span className="flex-1 break-all text-sm">{m.email}</span>
                      <Select
                        value={managerTrackEdits[m.id] ?? m.trackName}
                        onValueChange={(v) => setManagerTrackEdits((prev) => ({ ...prev, [m.id]: v }))}
                      >
                        <SelectTrigger className="w-full sm:w-56" aria-label={`Track for ${m.email}`}>
                          <SelectValue placeholder="Select track" />
                        </SelectTrigger>
                        <SelectContent>
                          {trackOptions.map((name) => (
                            <SelectItem key={name} value={name}>
                              {name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => updateManager(m.id, managerTrackEdits[m.id] ?? m.trackName)}
                          disabled={managerBusy}
                        >
                          <Save className="h-4 w-4" /> Save
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => removeManager(m.email)}
                          disabled={managerBusy}
                        >
                          <Trash2 className="h-4 w-4" /> Remove
                        </Button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </CardContent>
        </Card>

        <Card className="glass-card">
          <CardHeader>
            <CardTitle className="text-lg">Manage Learning Tracks &amp; WhatsApp Groups</CardTitle>
            <CardDescription>
              Add or edit the WhatsApp group links for each learning track. Users are redirected to these groups right after registering.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <Input
                type="text"
                placeholder="Track name (e.g. Web Development)"
                value={newTrackName}
                onChange={(e) => setNewTrackName(e.target.value)}
                aria-label="Track name"
              />
              <Input
                type="url"
                placeholder="WhatsApp group link"
                value={newTrackLink}
                onChange={(e) => setNewTrackLink(e.target.value)}
                aria-label="WhatsApp group link"
              />
              <Button onClick={addTrack} disabled={trackBusy} className="w-full">
                {trackBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} Add
              </Button>
            </div>

            <div>
              <h4 className="mb-2 text-sm font-semibold">
                Learning Tracks{" "}
                <span className="ml-1 rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">
                  {tracks.length}
                </span>
              </h4>
              <ul className="space-y-2">
                {tracks.length === 0 ? (
                  <li className="text-sm text-muted-foreground">No learning tracks yet.</li>
                ) : (
                  tracks.map((t) => {
                    const edit = trackEdits[t.id] ?? { name: t.name, whatsappLink: t.whatsappLink };
                    return (
                      <li key={t.id} className="rounded-md border border-border bg-background/60 p-3 space-y-2">
                        <div className="grid gap-2 sm:grid-cols-2">
                          <Input
                            type="text"
                            value={edit.name}
                            onChange={(e) =>
                              setTrackEdits((prev) => ({
                                ...prev,
                                [t.id]: { ...edit, name: e.target.value },
                              }))
                            }
                            aria-label={`Name of ${t.name}`}
                          />
                          <Input
                            type="url"
                            value={edit.whatsappLink}
                            onChange={(e) =>
                              setTrackEdits((prev) => ({
                                ...prev,
                                [t.id]: { ...edit, whatsappLink: e.target.value },
                              }))
                            }
                            aria-label={`WhatsApp link for ${t.name}`}
                          />
                        </div>
                        <div className="flex justify-end gap-2">
                          <Button size="sm" variant="secondary" onClick={() => updateTrack(t.id)} disabled={trackBusy}>
                            <Save className="h-4 w-4" /> Save
                          </Button>
                          <Button size="sm" variant="destructive" onClick={() => deleteTrack(t.id)} disabled={trackBusy}>
                            <Trash2 className="h-4 w-4" /> Delete
                          </Button>
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          </CardContent>
        </Card>
      </div>
      {dialog}
    </DashboardShell>
  );
}