"use client";

import { useEffect, useState } from "react";
import { Award, FileText, Loader2, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useModal } from "@/components/use-modal";

const emailHeader = (email: string) => ({ "X-User-Email": email });

type Props = {
  email: string;
  trackName: string;
};

export function ManagerCertificateEditor({ email, trackName }: Props) {
  const { showAlert, confirm, dialogs } = useModal();
  const [description, setDescription] = useState("");
  const [defaultDescription, setDefaultDescription] = useState("");
  const [isCustom, setIsCustom] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadDescription() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/certificate/track-description?track=${encodeURIComponent(trackName)}`,
        { headers: emailHeader(email) }
      );
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setDescription(data.description || "");
        setDefaultDescription(data.defaultDescription || "");
        setIsCustom(Boolean(data.isCustom));
      }
    } catch {
      /* fallback */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (trackName) {
      void loadDescription();
    }
  }, [trackName]);

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch("/api/certificate/track-description", {
        method: "PUT",
        headers: {
          ...emailHeader(email),
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ trackName, description }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setIsCustom(Boolean(description.trim() && description.trim() !== defaultDescription.trim()));
        showAlert(
          "Description Saved",
          data.message || `Certificate description for ${trackName} track updated successfully.`,
          "success"
        );
      } else {
        showAlert("Error", data.error || "Failed to update track description.", "error");
      }
    } catch {
      showAlert("Network Error", "Could not save track description. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    const ok = await confirm(
      "Reset to Global Default?",
      "This will replace your track-specific description with the organization default certificate text.",
      {
        confirmLabel: "Reset to Default",
        destructive: true,
      }
    );
    if (ok) {
      setDescription(defaultDescription);
    }
  }

  return (
    <>
      {dialogs}
      <Card className="glass-card border-primary/20 shadow-md">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" /> Certificate Description Body Text
              </CardTitle>
              {isCustom ? (
                <Badge variant="secondary" className="text-xs bg-primary/15 text-primary border-primary/30">
                  Track-Specific Custom
                </Badge>
              ) : (
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  Global Default
                </Badge>
              )}
            </div>
            <CardDescription className="mt-1">
              Customize the certificate body paragraph specifically for participants who complete the{" "}
              <strong className="text-foreground font-semibold">{trackName}</strong> track.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving || loading || description === defaultDescription}
              className="text-xs"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to Default
            </Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving || loading || !description.trim()}
              className="bg-primary text-primary-foreground shadow-sm text-xs"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-3.5 w-3.5" />
              )}
              Save Description
            </Button>
          </div>
        </CardHeader>

        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin text-primary" /> Loading description…
            </div>
          ) : (
            <div className="space-y-3">
              <div className="relative">
                <textarea
                  rows={5}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter the certificate evaluation body text for this track…"
                  className="w-full rounded-md border border-input bg-background/80 px-3.5 py-2.5 text-sm leading-relaxed shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                />
              </div>

              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  All approved participants in the <strong className="font-medium text-foreground">{trackName}</strong> track will receive this exact text on their certificate.
                </span>
                <span>{description.length} characters</span>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
