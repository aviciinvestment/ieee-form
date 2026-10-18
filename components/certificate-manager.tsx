"use client";

import { useEffect, useState } from "react";
import { Award, Check, Eye, Loader2, RefreshCw, RotateCcw, Save } from "lucide-react";
import { CertificateViewer } from "@/components/certificate-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModal } from "@/components/use-modal";
import { DEFAULT_CERTIFICATE_TEMPLATE, type CertificateTemplate } from "@/lib/types";

const emailHeader = (email: string) => ({ "X-User-Email": email });

type Props = {
  email: string;
};

export function CertificateManager({ email }: Props) {
  const { showAlert, confirm, dialogs } = useModal();
  const [template, setTemplate] = useState<CertificateTemplate>(DEFAULT_CERTIFICATE_TEMPLATE);
  const [previewName, setPreviewName] = useState("Tarun Vishwkarma");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function loadTemplate() {
    setLoading(true);
    try {
      const res = await fetch("/api/certificate/template");
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.data) {
        setTemplate(data.data);
      }
    } catch {
      /* fallback */
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadTemplate();
  }, []);

  async function saveTemplate() {
    setSaving(true);
    try {
      const res = await fetch("/api/certificate/template", {
        method: "PUT",
        headers: {
          ...emailHeader(email),
          "Content-Type": "application/json",
        },
        body: JSON.stringify(template),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showAlert("Saved Successfully", "The certificate template content has been updated for all eligible participants.", "success");
      } else {
        showAlert("Error", data.error || "Failed to update certificate template.", "error");
      }
    } catch {
      showAlert("Network Error", "Could not save certificate template. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    const ok = await confirm(
      "Reset Certificate Content?",
      "This will reset all text, logo name, badge, and signatory details back to the default Alpha Capital template.",
      {
        confirmLabel: "Reset to Default",
        destructive: true,
      }
    );
    if (ok) {
      setTemplate(DEFAULT_CERTIFICATE_TEMPLATE);
    }
  }

  const [previewFirst, ...previewRest] = previewName.trim().split(" ");
  const previewLastName = previewRest.join(" ");

  return (
    <>
      {dialogs}
      <Card className="glass-card shadow-lg border-primary/20">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary" /> Certificate Template Editor
            </CardTitle>
            <CardDescription>
              Customize the certificate text, logo, badge, description, and signatory credentials. Only admins can edit these details.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving || loading}
              className="text-xs"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
            <Button
              size="sm"
              onClick={saveTemplate}
              disabled={saving || loading}
              className="bg-primary text-primary-foreground shadow-sm"
            >
              {saving ? (
                <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
              ) : (
                <Save className="mr-1.5 h-4 w-4" />
              )}
              Save Certificate
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Loading certificate template…
            </div>
          ) : (
            <div className="grid gap-8 lg:grid-cols-12">
              {/* Form Controls Column */}
              <div className="lg:col-span-5 space-y-4">
                <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-3.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Header & Branding
                  </h4>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="logoName" className="text-xs">Logo Name</Label>
                      <Input
                        id="logoName"
                        value={template.logoName}
                        onChange={(e) => setTemplate({ ...template, logoName: e.target.value })}
                        placeholder="ALPHA CAPITAL"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="badgeText" className="text-xs">Badge Text</Label>
                      <Input
                        id="badgeText"
                        value={template.badgeText}
                        onChange={(e) => setTemplate({ ...template, badgeText: e.target.value })}
                        placeholder="PHASE 1"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="logoUrl" className="text-xs">
                      Custom Logo Image URL <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="logoUrl"
                      value={template.logoUrl || ""}
                      onChange={(e) => setTemplate({ ...template, logoUrl: e.target.value })}
                      placeholder="https://... (leave empty for default icon)"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-3.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Certificate Titles & Body
                  </h4>

                  <div className="space-y-1">
                    <Label htmlFor="title" className="text-xs">Certificate Title</Label>
                    <Input
                      id="title"
                      value={template.title}
                      onChange={(e) => setTemplate({ ...template, title: e.target.value })}
                      placeholder="Certificate&#10;Of Achievement"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="subtitle" className="text-xs">Subtitle</Label>
                    <Input
                      id="subtitle"
                      value={template.subtitle}
                      onChange={(e) => setTemplate({ ...template, subtitle: e.target.value })}
                      placeholder="Proudly presented to"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="bodyText" className="text-xs">Description Body Text</Label>
                    <textarea
                      id="bodyText"
                      rows={4}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={template.bodyText}
                      onChange={(e) => setTemplate({ ...template, bodyText: e.target.value })}
                      placeholder="Enter the certificate description paragraph…"
                    />
                  </div>
                </div>

                <div className="p-3.5 rounded-lg border border-border/60 bg-background/50 space-y-3.5">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Signatory & Date
                  </h4>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="space-y-1">
                      <Label htmlFor="dateText" className="text-xs">Date Text</Label>
                      <Input
                        id="dateText"
                        value={template.dateText}
                        onChange={(e) => setTemplate({ ...template, dateText: e.target.value })}
                        placeholder="26 Aug 2025"
                      />
                    </div>

                    <div className="space-y-1">
                      <Label htmlFor="signatoryName" className="text-xs">Signatory Name</Label>
                      <Input
                        id="signatoryName"
                        value={template.signatoryName}
                        onChange={(e) => setTemplate({ ...template, signatoryName: e.target.value })}
                        placeholder="George Kohler"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signatoryTitle" className="text-xs">Signatory Title</Label>
                    <Input
                      id="signatoryTitle"
                      value={template.signatoryTitle}
                      onChange={(e) => setTemplate({ ...template, signatoryTitle: e.target.value })}
                      placeholder="Managing Director"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label htmlFor="signatureUrl" className="text-xs">
                      Custom Signature Image URL <span className="text-muted-foreground font-normal">(optional)</span>
                    </Label>
                    <Input
                      id="signatureUrl"
                      value={template.signatureUrl || ""}
                      onChange={(e) => setTemplate({ ...template, signatureUrl: e.target.value })}
                      placeholder="https://... (leave empty for cursive script)"
                    />
                  </div>
                </div>
              </div>

              {/* Live Preview Column */}
              <div className="lg:col-span-7 flex flex-col space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Eye className="w-4 h-4 text-primary" /> Live Certificate Preview
                  </div>

                  <div className="flex items-center gap-2">
                    <Label htmlFor="testName" className="text-xs text-muted-foreground whitespace-nowrap">
                      Test Candidate:
                    </Label>
                    <Input
                      id="testName"
                      value={previewName}
                      onChange={(e) => setPreviewName(e.target.value)}
                      className="h-7 text-xs w-44"
                      placeholder="Type name to preview…"
                    />
                  </div>
                </div>

                <div className="p-2 sm:p-3 rounded-xl border border-border/50 bg-black/60 shadow-inner">
                  <CertificateViewer
                    participant={{
                      firstName: previewFirst || "Tarun",
                      lastName: previewLastName || "Vishwkarma",
                      techSkill: "Python Programming",
                    }}
                    template={template}
                    showDownloadButtons={false}
                  />
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
