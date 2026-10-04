"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Loader2, Pencil, Plus, RefreshCw, Search, Trash2, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useModal } from "@/components/use-modal";
import { formatDateTime } from "@/lib/format";
import { DEFAULT_LIMIT, MAX_LIMIT } from "@/lib/registrations";
import type {
  Registration,
  RegistrationFormValues,
  RegistrationSearchField,
  RegistrationSortField,
  SortOrder,
} from "@/lib/types";

const emailHeader = (email: string) => ({ "X-User-Email": email });

const PAGE_SIZES = ["10", "25", "50", "100"] as const;

const SEARCH_FIELD_LABELS: Record<RegistrationSearchField, string> = {
  all: "All fields",
  name: "Name",
  email: "Email",
  date: "Date",
};

const SORT_LABELS: Record<RegistrationSortField, string> = {
  name: "Name",
  email: "Email",
  date: "Date registered",
  track: "Track",
  phone: "Phone",
};

type Filters = {
  q: string;
  field: RegistrationSearchField;
  from: string;
  to: string;
  sort: RegistrationSortField;
  order: SortOrder;
  limit: number;
  offset: number;
};

const DEFAULT_FILTERS: Filters = {
  q: "",
  field: "all",
  from: "",
  to: "",
  sort: "date",
  order: "desc",
  limit: DEFAULT_LIMIT,
  offset: 0,
};

const EMPTY_FORM: RegistrationFormValues = {
  firstName: "",
  lastName: "",
  phone: "",
  techSkill: "",
  email: "",
};

type DialogState = { mode: "create" | "edit"; id: string | null; values: RegistrationFormValues } | null;

export type RegistrationsManagerProps = {
  email: string;
  tracks: string[];
  lockedTrack?: string;
  emptyMessage?: string;
};

export function RegistrationsManager({ email, tracks, lockedTrack, emptyMessage }: RegistrationsManagerProps) {
  const { confirm, dialogs } = useModal();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [qInput, setQInput] = useState("");
  const [rows, setRows] = useState<Registration[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const trackOptions = useMemo(() => {
    const all = lockedTrack ? [lockedTrack, ...tracks] : tracks;
    return Array.from(new Set(all.filter(Boolean)));
  }, [lockedTrack, tracks]);

  useEffect(() => {
    const timer = setTimeout(() => {
      const next = qInput.trim();
      setFilters((prev) => (prev.q === next ? prev : { ...prev, q: next, offset: 0 }));
    }, 350);
    return () => clearTimeout(timer);
  }, [qInput]);

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!email) return;
      setLoading(true);
      setError("");
      try {
        const params = new URLSearchParams();
        if (filters.q) params.set("q", filters.q);
        params.set("field", filters.field);
        if (filters.from) params.set("from", filters.from);
        if (filters.to) params.set("to", filters.to);
        params.set("sort", filters.sort);
        params.set("order", filters.order);
        params.set("limit", String(filters.limit));
        params.set("offset", String(filters.offset));

        const res = await fetch(`/api/registrations?${params.toString()}`, { headers: emailHeader(email) });
        const data = await res.json().catch(() => ({}));
        if (!active) return;
        if (res.status === 401 || res.status === 403) {
          window.location.href = "/login";
          return;
        }
        if (!res.ok) {
          setRows([]);
          setTotal(0);
          setError(data.error || "Failed to load registrations.");
          return;
        }
        setRows(data.data ?? []);
        setTotal(data.total ?? 0);
      } catch {
        if (active) setError("Network error while loading registrations.");
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, [email, filters, reloadKey]);

  function patchFilters(patch: Partial<Filters>) {
    setFilters((prev) => ({ ...prev, offset: 0, ...patch }));
  }

  function toggleSort(field: RegistrationSortField) {
    setFilters((prev) => ({
      ...prev,
      sort: field,
      order: prev.sort === field && prev.order === "asc" ? "desc" : "asc",
      offset: 0,
    }));
  }

  function clearFilters() {
    setQInput("");
    setFilters((prev) => ({ ...DEFAULT_FILTERS, limit: prev.limit }));
  }

  function openCreate() {
    setDialog({
      mode: "create",
      id: null,
      values: { ...EMPTY_FORM, techSkill: lockedTrack ?? trackOptions[0] ?? "" },
    });
  }

  function openEdit(row: Registration) {
    setDialog({
      mode: "edit",
      id: row.id,
      values: {
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone,
        techSkill: row.techSkill,
        email: row.email,
      },
    });
  }

  async function saveDialog() {
    if (!dialog) return;
    if (!dialog.values.firstName || !dialog.values.lastName || !dialog.values.phone || !dialog.values.email) {
      setError("First name, last name, phone and email are all required.");
      return;
    }
    if (!dialog.values.techSkill) {
      setError("Please choose a learning track.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      const isEdit = dialog.mode === "edit" && dialog.id;
      const res = await fetch(isEdit ? `/api/registrations/${encodeURIComponent(dialog.id as string)}` : "/api/registrations", {
        method: isEdit ? "PUT" : "POST",
        headers: { ...emailHeader(email), "Content-Type": "application/json" },
        body: JSON.stringify(dialog.values),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      setDialog(null);
      setReloadKey((key) => key + 1);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSaving(false);
    }
  }

  async function removeRow(row: Registration) {
    const ok = await confirm(
      `Delete ${row.firstName} ${row.lastName}?`,
      `${row.email} will be removed permanently, along with any quiz attempts they have submitted. This cannot be undone.`,
      { confirmLabel: "Delete participant", destructive: true }
    );
    if (!ok) return;
    setDeletingId(row.id);
    setError("");
    try {
      const res = await fetch(`/api/registrations/${encodeURIComponent(row.id)}`, {
        method: "DELETE",
        headers: emailHeader(email),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Could not delete this user.");
        return;
      }
      setRows((prev) => {
        const next = prev.filter((item) => item.id !== row.id);
        if (next.length === 0 && filters.offset > 0) {
          setFilters((current) => ({ ...current, offset: Math.max(current.offset - filters.limit, 0) }));
        }
        return next;
      });
      setTotal((prev) => Math.max(prev - 1, 0));
    } catch {
      setError("Network error. Could not delete this user.");
    } finally {
      setDeletingId(null);
    }
  }

  const hasActiveFilters = Boolean(filters.q || filters.from || filters.to || filters.field !== "all");
  const from = total === 0 ? 0 : filters.offset + 1;
  const to = Math.min(filters.offset + rows.length, total);
  const canPrev = filters.offset > 0;
  const canNext = filters.offset + filters.limit < total;

  function sortIcon(field: RegistrationSortField) {
    if (filters.sort !== field) return <ArrowUpDown className="h-3.5 w-3.5 opacity-40" />;
    return filters.order === "asc" ? <ArrowUp className="h-3.5 w-3.5" /> : <ArrowDown className="h-3.5 w-3.5" />;
  }

  function SortableHead({
    field,
    children,
    className,
  }: {
    field: RegistrationSortField;
    children: React.ReactNode;
    className?: string;
  }) {
    return (
      <TableHead className={className}>
        <button
          type="button"
          onClick={() => toggleSort(field)}
          className="flex items-center gap-1.5 whitespace-nowrap hover:text-foreground"
          aria-label={`Sort by ${SORT_LABELS[field]}`}
        >
          {children}
          {sortIcon(field)}
        </button>
      </TableHead>
    );
  }

  return (
    <div className="space-y-4">
      <div className="rounded-md border bg-card p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_10rem_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              placeholder={
                filters.field === "date"
                  ? "Search by date (YYYY-MM-DD)…"
                  : filters.field === "email"
                    ? "Search by email…"
                    : filters.field === "name"
                      ? "Search by first or last name…"
                      : "Search by name, email or phone…"
              }
              className="pl-9"
              aria-label="Search registrations"
            />
          </div>

          <Select
            value={filters.field}
            onValueChange={(value) => patchFilters({ field: value as RegistrationSearchField })}
          >
            <SelectTrigger aria-label="Search field">
              <SelectValue placeholder="Search in" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(SEARCH_FIELD_LABELS) as RegistrationSearchField[]).map((value) => (
                <SelectItem key={value} value={value}>
                  {SEARCH_FIELD_LABELS[value]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <div className="flex gap-2">
            <Button onClick={openCreate} className="flex-1 lg:flex-none">
              <Plus className="h-4 w-4" /> Add user
            </Button>
            <Button
              variant="outline"
              onClick={() => setReloadKey((key) => key + 1)}
              disabled={loading}
              aria-label="Refresh registrations"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <Label htmlFor="filter-from" className="text-xs text-muted-foreground">
              Registered from
            </Label>
            <Input
              id="filter-from"
              type="date"
              value={filters.from}
              max={filters.to || undefined}
              onChange={(e) => patchFilters({ from: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="filter-to" className="text-xs text-muted-foreground">
              Registered to
            </Label>
            <Input
              id="filter-to"
              type="date"
              value={filters.to}
              min={filters.from || undefined}
              onChange={(e) => patchFilters({ to: e.target.value })}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Sort by</Label>
            <Select
              value={filters.sort}
              onValueChange={(value) => patchFilters({ sort: value as RegistrationSortField })}
            >
              <SelectTrigger aria-label="Sort by">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(SORT_LABELS) as RegistrationSortField[]).map((value) => (
                  <SelectItem key={value} value={value}>
                    {SORT_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Direction</Label>
            <div className="flex gap-2">
              <Button
                type="button"
                variant={filters.order === "asc" ? "secondary" : "outline"}
                onClick={() => patchFilters({ order: "asc" })}
                className="flex-1"
              >
                <ArrowUp className="h-4 w-4" /> Asc
              </Button>
              <Button
                type="button"
                variant={filters.order === "desc" ? "secondary" : "outline"}
                onClick={() => patchFilters({ order: "desc" })}
                className="flex-1"
              >
                <ArrowDown className="h-4 w-4" /> Desc
              </Button>
            </div>
          </div>
        </div>

        {hasActiveFilters ? (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span>Active filters:</span>
            {filters.q ? <Badge variant="secondary">“{filters.q}” in {SEARCH_FIELD_LABELS[filters.field]}</Badge> : null}
            {filters.from ? <Badge variant="secondary">From {filters.from}</Badge> : null}
            {filters.to ? <Badge variant="secondary">To {filters.to}</Badge> : null}
            <Button type="button" variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2">
              <X className="h-3.5 w-3.5" /> Clear
            </Button>
          </div>
        ) : null}
      </div>

      {loading ? (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading registrations…
        </p>
      ) : error ? (
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
      ) : (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">{total}</span> matching user{total === 1 ? "" : "s"}
              {total > 0 ? ` · showing ${from}–${to}` : ""}
            </p>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <span>Rows</span>
              <Select
                value={String(filters.limit)}
                onValueChange={(value) => patchFilters({ limit: Math.min(Number(value) || DEFAULT_LIMIT, MAX_LIMIT) })}
              >
                <SelectTrigger className="h-9 w-20" aria-label="Rows per page">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAGE_SIZES.map((size) => (
                    <SelectItem key={size} value={size}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto rounded-md border bg-card">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <SortableHead field="name">Name</SortableHead>
                  <SortableHead field="phone">Phone</SortableHead>
                  <SortableHead field="track">Track</SortableHead>
                  <SortableHead field="email">Email</SortableHead>
                  <SortableHead field="date">Date</SortableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="py-12 text-center text-muted-foreground">
                      {emptyMessage ?? "No users match your filters."}
                    </TableCell>
                  </TableRow>
                ) : (
                  rows.map((r, i) => (
                    <TableRow key={r.id}>
                      <TableCell className="text-muted-foreground">{filters.offset + i + 1}</TableCell>
                      <TableCell className="font-medium">
                        {r.firstName} {r.lastName}
                      </TableCell>
                      <TableCell className="whitespace-nowrap">{r.phone}</TableCell>
                      <TableCell>
                        <Badge variant="secondary">{r.techSkill}</Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      <TableCell className="whitespace-nowrap text-muted-foreground">
                        {formatDateTime(r.createdAt)}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={() => openEdit(r)}
                            aria-label={`Edit ${r.firstName} ${r.lastName}`}
                          >
                            <Pencil className="h-4 w-4" /> Edit
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => removeRow(r)}
                            disabled={deletingId === r.id}
                            aria-label={`Delete ${r.firstName} ${r.lastName}`}
                          >
                            {deletingId === r.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={!canPrev}
              onClick={() => setFilters((prev) => ({ ...prev, offset: Math.max(prev.offset - prev.limit, 0) }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={!canNext}
              onClick={() => setFilters((prev) => ({ ...prev, offset: prev.offset + prev.limit }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}

      <Dialog open={dialog !== null} onOpenChange={(open) => !open && setDialog(null)}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{dialog?.mode === "edit" ? "Update user" : "Add new user"}</DialogTitle>
            <DialogDescription>
              {dialog?.mode === "edit"
                ? "Update this participant's details."
                : lockedTrack
                  ? `New users you add are placed in the ${lockedTrack} track.`
                  : "Add a participant directly to the register."}
            </DialogDescription>
          </DialogHeader>

          {dialog ? (
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="form-first-name">First name</Label>
                <Input
                  id="form-first-name"
                  value={dialog.values.firstName}
                  onChange={(e) =>
                    setDialog({ ...dialog, values: { ...dialog.values, firstName: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-last-name">Last name</Label>
                <Input
                  id="form-last-name"
                  value={dialog.values.lastName}
                  onChange={(e) =>
                    setDialog({ ...dialog, values: { ...dialog.values, lastName: e.target.value } })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-phone">Phone</Label>
                <Input
                  id="form-phone"
                  value={dialog.values.phone}
                  onChange={(e) => setDialog({ ...dialog, values: { ...dialog.values, phone: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="form-email">Email</Label>
                <Input
                  id="form-email"
                  type="email"
                  value={dialog.values.email}
                  onChange={(e) => setDialog({ ...dialog, values: { ...dialog.values, email: e.target.value } })}
                />
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label>Learning track</Label>
                {lockedTrack ? (
                  <Input value={lockedTrack} readOnly disabled />
                ) : (
                  <Select
                    value={dialog.values.techSkill}
                    onValueChange={(value) => setDialog({ ...dialog, values: { ...dialog.values, techSkill: value } })}
                  >
                    <SelectTrigger aria-label="Learning track">
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
                )}
              </div>
            </div>
          ) : null}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={saving}>
              Cancel
            </Button>
            <Button onClick={saveDialog} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {dialog?.mode === "edit" ? "Save changes" : "Add user"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {dialogs}
    </div>
  );
}