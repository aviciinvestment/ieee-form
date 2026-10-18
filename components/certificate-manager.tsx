"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Check, Eye, Loader2, RefreshCw, RotateCcw, Save, Upload, X } from "lucide-react";
import { CertificateViewer } from "@/components/certificate-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModal } from "@/components/use-modal";
import { DEFAULT_CERTIFICATE_TEMPLATE, MAX_CERTIFICATE_BODY_LENGTH, type CertificateTemplate } from "@/lib/types";

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
  const logoFileInputRef = useRef<HTMLInputElement>(null);
  const sigFileInputRef = useRef<HTMLInputElement>(null);

  function normalizeImageUrl(input: string): string {
    if (!input) return "";
    let url = input.trim();
    if (url.startsWith("data:")) return url;

    // Convert Google Drive view/open links to direct image source
    const gDriveMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/) || url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    if (gDriveMatch && gDriveMatch[1]) {
      return `https://lh3.googleusercontent.com/d/${gDriveMatch[1]}`;
    }

    // Convert Dropbox share links to raw file
    if (url.includes("dropbox.com") && url.includes("dl=0")) {
      return url.replace("dl=0", "raw=1");
    }

    // Local public assets
    if (url === "logo.svg" || url === "download.png" || url === "download.jpg" || url === "certificate-base.png") {
      return `/${url}`;
    }

    return url;
  }

  function handleImageUpload(file: File, callback: (dataUrl: string) => void) {
    if (!file.type.startsWith("image/")) {
      showAlert("Invalid File", "Please select an image file (PNG, JPG, SVG, WEBP).", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      if (!raw) return;

      if (file.type === "image/svg+xml" || file.size < 60000) {
        callback(raw);
        return;
      }

      // Optimize raster images so they store cleanly in database
      const img = new Image();
      img.onload = () => {
        const maxDim = 500;
        let width = img.width;
        let height = img.height;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          callback(canvas.toDataURL("image/png"));
        } else {
          callback(raw);
        }
      };
      img.onerror = () => callback(raw);
      img.src = raw;
    };
    reader.readAsDataURL(file);
  }

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
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 min-w-0">
          <div className="min-w-0">
            <CardTitle className="text-base sm:text-lg flex items-center gap-2">
              <Award className="h-5 w-5 text-primary shrink-0" /> Certificate Template Editor
            </CardTitle>
            <CardDescription className="text-xs sm:text-sm mt-1">
              Customize the certificate text, logo, badge, description, and signatory credentials. Only admins can edit these details.
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={handleReset}
              disabled={saving || loading}
              className="text-xs flex-1 sm:flex-none"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset
            </Button>
            <Button
              size="sm"
              onClick={saveTemplate}
              disabled={saving || loading}
              className="bg-primary text-primary-foreground shadow-sm text-xs flex-1 sm:flex-none"
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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="logoUrl" className="text-xs font-medium">
                        Custom Logo Image <span className="text-muted-foreground font-normal">(URL or Upload)</span>
                      </Label>
                      {template.logoUrl ? (
                        <button
                          type="button"
                          onClick={() => setTemplate({ ...template, logoUrl: "" })}
                          className="text-[11px] text-destructive hover:underline"
                        >
                          Reset to default
                        </button>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        id="logoUrl"
                        value={template.logoUrl || ""}
                        onChange={(e) => setTemplate({ ...template, logoUrl: e.target.value })}
                        onBlur={(e) => setTemplate({ ...template, logoUrl: normalizeImageUrl(e.target.value) })}
                        placeholder="Paste image URL or click Upload…"
                        className="text-xs"
                      />
                      <input
                        ref={logoFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, (url) => setTemplate((prev) => ({ ...prev, logoUrl: url })));
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs px-2.5 h-9"
                        onClick={() => logoFileInputRef.current?.click()}
                        title="Upload logo from device"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                      </Button>
                    </div>

                    {/* Presets */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                      <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Presets:</span>
                      <button
                        type="button"
                        onClick={() => setTemplate({ ...template, logoUrl: "/logo.svg", logoName: "IEEE STUDENT BRANCH" })}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                      >
                        IEEE Logo
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplate({ ...template, logoUrl: "/download.png", logoName: "NAU BRANCH" })}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                      >
                        NAU Logo
                      </button>
                      <button
                        type="button"
                        onClick={() => setTemplate({ ...template, logoUrl: "" })}
                        className="text-[11px] px-2 py-0.5 rounded-full bg-secondary hover:bg-primary/20 hover:text-primary transition-colors text-muted-foreground"
                      >
                        Default Icon
                      </button>
                    </div>

                    {/* Active Logo status/preview */}
                    {template.logoUrl ? (
                      <div className="flex items-center gap-2.5 p-2 rounded-md border border-border/80 bg-black/40 text-xs">
                        <div className="w-8 h-8 rounded bg-black/60 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={template.logoUrl}
                            alt="Logo Preview"
                            className="w-full h-full object-contain"
                            onError={(e) => {
                              (e.currentTarget as HTMLElement).style.display = "none";
                            }}
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-white truncate">Active Custom Logo</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {template.logoUrl.startsWith("data:") ? "Uploaded local image" : template.logoUrl}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setTemplate({ ...template, logoUrl: "" })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
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
                    <div className="flex items-center justify-between">
                      <Label htmlFor="bodyText" className="text-xs">Description Body Text</Label>
                      <span className={`text-[11px] font-mono ${template.bodyText.length >= MAX_CERTIFICATE_BODY_LENGTH ? "text-amber-500 font-semibold" : "text-muted-foreground"}`}>
                        {template.bodyText.length} / {MAX_CERTIFICATE_BODY_LENGTH}
                      </span>
                    </div>
                    <textarea
                      id="bodyText"
                      rows={4}
                      maxLength={MAX_CERTIFICATE_BODY_LENGTH}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                      value={template.bodyText}
                      onChange={(e) => setTemplate({ ...template, bodyText: e.target.value })}
                      placeholder={`Enter the certificate description paragraph (max ${MAX_CERTIFICATE_BODY_LENGTH} characters)…`}
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

                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="signatureUrl" className="text-xs font-medium">
                        Custom Signature Image <span className="text-muted-foreground font-normal">(URL or Upload)</span>
                      </Label>
                      {template.signatureUrl ? (
                        <button
                          type="button"
                          onClick={() => setTemplate({ ...template, signatureUrl: "" })}
                          className="text-[11px] text-destructive hover:underline"
                        >
                          Reset to script
                        </button>
                      ) : null}
                    </div>

                    <div className="flex gap-2">
                      <Input
                        id="signatureUrl"
                        value={template.signatureUrl || ""}
                        onChange={(e) => setTemplate({ ...template, signatureUrl: e.target.value })}
                        onBlur={(e) => setTemplate({ ...template, signatureUrl: normalizeImageUrl(e.target.value) })}
                        placeholder="https://... or click Upload"
                        className="text-xs"
                      />
                      <input
                        ref={sigFileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) handleImageUpload(file, (url) => setTemplate((prev) => ({ ...prev, signatureUrl: url })));
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 text-xs px-2.5 h-9"
                        onClick={() => sigFileInputRef.current?.click()}
                        title="Upload signature image"
                      >
                        <Upload className="h-3.5 w-3.5 mr-1" /> Upload
                      </Button>
                    </div>

                    {template.signatureUrl ? (
                      <div className="flex items-center gap-2.5 p-2 rounded-md border border-border/80 bg-black/40 text-xs">
                        <div className="w-8 h-8 rounded bg-black/60 border border-white/20 flex items-center justify-center overflow-hidden shrink-0">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={template.signatureUrl}
                            alt="Signature Preview"
                            className="w-full h-full object-contain filter invert brightness-200"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] font-medium text-white truncate">Active Custom Signature</p>
                          <p className="text-[10px] text-slate-400 truncate">
                            {template.signatureUrl.startsWith("data:") ? "Uploaded local image" : template.signatureUrl}
                          </p>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                          onClick={() => setTemplate({ ...template, signatureUrl: "" })}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              {/* Live Preview Column */}
              <div className="lg:col-span-7 flex flex-col space-y-3 min-w-0 w-full">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 min-w-0 w-full">
                  <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    <Eye className="w-4 h-4 text-primary shrink-0" /> Live Certificate Preview
                  </div>

                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Label htmlFor="testName" className="text-xs text-muted-foreground whitespace-nowrap shrink-0">
                      Test Candidate:
                    </Label>
                    <Input
                      id="testName"
                      value={previewName}
                      onChange={(e) => setPreviewName(e.target.value)}
                      className="h-8 sm:h-7 text-xs flex-1 sm:w-44"
                      placeholder="Type name to preview…"
                    />
                  </div>
                </div>

                <div className="p-2 sm:p-3 rounded-xl border border-border/50 bg-black/60 shadow-inner w-full overflow-hidden">
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
