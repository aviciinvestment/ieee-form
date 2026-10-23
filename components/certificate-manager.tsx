"use client";

import { useEffect, useRef, useState } from "react";
import { Award, Check, ChevronDown, ChevronUp, FileText, Image as ImageIcon, Loader2, RotateCcw, Save, Trash2, Upload, UserCheck } from "lucide-react";
import { CertificateViewer } from "@/components/certificate-viewer";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useModal } from "@/components/use-modal";
import { DEFAULT_CERTIFICATE_TEMPLATE, type CertificateTemplate } from "@/lib/types";
import { getAuthHeaders } from "@/lib/firebase";

type Props = {
  email: string;
};

export function CertificateManager({ email }: Props) {
  const { showAlert, confirm, dialogs } = useModal();
  const [template, setTemplate] = useState<CertificateTemplate>(DEFAULT_CERTIFICATE_TEMPLATE);
  const [previewName, setPreviewName] = useState("Jane Doe");
  const [previewTrack, setPreviewTrack] = useState("Web Development");
  const [showAdvancedText, setShowAdvancedText] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const sigFileInputRef = useRef<HTMLInputElement>(null);
  const sig2FileInputRef = useRef<HTMLInputElement>(null);

  // Helper to read and optimize PNG signature file into a data URL
  function handleSignatureUpload(
    file: File,
    onSuccess: (dataUrl: string) => void
  ) {
    if (file.type !== "image/png" && !file.name.toLowerCase().endsWith(".png")) {
      showAlert("PNG Required", "Please select a PNG file (.png) for the signature.", "error");
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const raw = e.target?.result as string;
      if (!raw) return;

      // Optimize raster PNG so it fits comfortably
      const img = new Image();
      img.onload = () => {
        const maxW = 400;
        const maxH = 160;
        let width = img.width;
        let height = img.height;

        if (width > maxW || height > maxH) {
          const ratio = Math.min(maxW / width, maxH / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0, width, height);
          onSuccess(canvas.toDataURL("image/png"));
        } else {
          onSuccess(raw);
        }
      };
      img.onerror = () => onSuccess(raw);
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
        setTemplate({
          ...DEFAULT_CERTIFICATE_TEMPLATE,
          ...data.data,
        });
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
      const headers = await getAuthHeaders();
      const res = await fetch("/api/certificate/template", {
        method: "PUT",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(template),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        showAlert(
          "Certificate Updated",
          "Signee details and certificate content have been successfully saved for all participants.",
          "success"
        );
      } else {
        showAlert("Error", data.error || "Failed to update certificate settings.", "error");
      }
    } catch {
      showAlert("Network Error", "Could not save certificate settings. Please try again.", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleResetText() {
    const ok = await confirm(
      "Reset Flier Texts?",
      "This will restore the certificate title, subtitle, and completion text back to the default flier text.",
      {
        confirmLabel: "Reset Text",
      }
    );
    if (ok) {
      setTemplate((prev) => ({
        ...prev,
        title: DEFAULT_CERTIFICATE_TEMPLATE.title,
        subtitle: DEFAULT_CERTIFICATE_TEMPLATE.subtitle,
        bodyText: DEFAULT_CERTIFICATE_TEMPLATE.bodyText,
        defaultTrack: DEFAULT_CERTIFICATE_TEMPLATE.defaultTrack,
      }));
    }
  }

  return (
    <>
      {dialogs}
      <div className="space-y-6">
        {/* Top Overview & Save Bar */}
        <Card className="glass-card border-primary/25 shadow-md">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Award className="h-5 w-5 text-primary" /> Certificate Configuration
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm mt-1">
                Configure signee credentials and signature PNGs. Participant name and project track are placed automatically for each client.
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={loadTemplate}
                disabled={loading || saving}
                className="text-xs"
              >
                <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reload
              </Button>
              <Button
                size="sm"
                onClick={saveTemplate}
                disabled={loading || saving}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs shadow-sm"
              >
                {saving ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="mr-1.5 h-3.5 w-3.5" />
                )}
                Save Changes
              </Button>
            </div>
          </CardHeader>
        </Card>

        {/* Main Settings Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {/* 1. Primary Signee Settings */}
          <Card className="glass-card border-primary/20 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-primary" /> Primary Signee (Left Signature)
              </CardTitle>
              <CardDescription className="text-xs">
                Enter the name and position of the primary signee, and upload their PNG signature.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signatoryName" className="text-xs font-semibold">
                  Signee Full Name
                </Label>
                <Input
                  id="signatoryName"
                  value={template.signatoryName || ""}
                  onChange={(e) => setTemplate((t) => ({ ...t, signatoryName: e.target.value }))}
                  placeholder="e.g. Engr. Patrick Okafor"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signatoryTitle" className="text-xs font-semibold">
                  Signee Position / Role
                </Label>
                <Input
                  id="signatoryTitle"
                  value={template.signatoryTitle || ""}
                  onChange={(e) => setTemplate((t) => ({ ...t, signatoryTitle: e.target.value }))}
                  placeholder="e.g. IEEE Branch Counselor"
                  className="text-sm"
                />
              </div>

              {/* PNG Signature File Upload */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold">
                  Signature File (PNG Only)
                </Label>
                <input
                  ref={sigFileInputRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleSignatureUpload(file, (dataUrl) => {
                        setTemplate((t) => ({ ...t, signatureUrl: dataUrl }));
                      });
                    }
                  }}
                />

                {template.signatureUrl ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card/60">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={template.signatureUrl}
                        alt="Signature Preview"
                        className="h-10 w-28 object-contain bg-slate-50 dark:bg-slate-900/60 p-1 rounded border border-border/40"
                      />
                      <span className="text-xs text-muted-foreground">PNG Loaded</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => sigFileInputRef.current?.click()}
                        className="text-xs h-8"
                      >
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setTemplate((t) => ({ ...t, signatureUrl: "" }))}
                        className="text-xs h-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => sigFileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center p-5 border-2 border-dashed border-border/70 hover:border-primary/60 rounded-lg bg-card/40 hover:bg-primary/5 transition-all text-center group cursor-pointer"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-1.5" />
                    <span className="text-xs font-semibold text-foreground">Click to upload signature PNG</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">Transparent PNG recommended</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 2. Secondary Signee Settings (Optional Right Signature) */}
          <Card className="glass-card border-border/60 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <UserCheck className="h-4 w-4 text-muted-foreground" /> Secondary Signee (Right Signature, Optional)
              </CardTitle>
              <CardDescription className="text-xs">
                Optional second signee for the right-hand signature line.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="signatory2Name" className="text-xs font-semibold">
                  Secondary Signee Full Name
                </Label>
                <Input
                  id="signatory2Name"
                  value={template.signatory2Name || ""}
                  onChange={(e) => setTemplate((t) => ({ ...t, signatory2Name: e.target.value }))}
                  placeholder="e.g. Dr. Chioma Nnamdi"
                  className="text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="signatory2Title" className="text-xs font-semibold">
                  Secondary Signee Position / Role
                </Label>
                <Input
                  id="signatory2Title"
                  value={template.signatory2Title || ""}
                  onChange={(e) => setTemplate((t) => ({ ...t, signatory2Title: e.target.value }))}
                  placeholder="e.g. Faculty Coordinator"
                  className="text-sm"
                />
              </div>

              {/* PNG Signature File Upload */}
              <div className="space-y-2 pt-1">
                <Label className="text-xs font-semibold">
                  Secondary Signature File (PNG Only)
                </Label>
                <input
                  ref={sig2FileInputRef}
                  type="file"
                  accept="image/png"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      handleSignatureUpload(file, (dataUrl) => {
                        setTemplate((t) => ({ ...t, signatory2SignatureUrl: dataUrl }));
                      });
                    }
                  }}
                />

                {template.signatory2SignatureUrl ? (
                  <div className="flex items-center justify-between p-3 rounded-lg border border-border/70 bg-card/60">
                    <div className="flex items-center gap-3">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={template.signatory2SignatureUrl}
                        alt="Signature 2 Preview"
                        className="h-10 w-28 object-contain bg-slate-50 dark:bg-slate-900/60 p-1 rounded border border-border/40"
                      />
                      <span className="text-xs text-muted-foreground">PNG Loaded</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => sig2FileInputRef.current?.click()}
                        className="text-xs h-8"
                      >
                        Replace
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setTemplate((t) => ({ ...t, signatory2SignatureUrl: "" }))}
                        className="text-xs h-8 text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => sig2FileInputRef.current?.click()}
                    className="w-full flex flex-col items-center justify-center p-5 border-2 border-dashed border-border/70 hover:border-primary/60 rounded-lg bg-card/40 hover:bg-primary/5 transition-all text-center group cursor-pointer"
                  >
                    <Upload className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors mb-1.5" />
                    <span className="text-xs font-semibold text-foreground">Click to upload second signature PNG</span>
                    <span className="text-[11px] text-muted-foreground mt-0.5">Optional</span>
                  </button>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 3. Certificate Text Details (Place in admin page where text details can be changed) */}
        <Card className="glass-card border-border/60">
          <CardHeader className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <FileText className="h-4 w-4 text-primary" /> Certificate Text Details (Customizable)
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  Default text matches the official flier. You can edit the text details below if needed.
                </CardDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAdvancedText(!showAdvancedText)}
                className="text-xs gap-1"
              >
                {showAdvancedText ? "Hide Text Fields" : "Edit Text Details"}
                {showAdvancedText ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              </Button>
            </div>
          </CardHeader>

          {showAdvancedText ? (
            <CardContent className="space-y-4 pt-1 border-t border-border/40">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="certTitle" className="text-xs font-semibold">
                    Certificate Heading
                  </Label>
                  <Input
                    id="certTitle"
                    value={template.title || ""}
                    onChange={(e) => setTemplate((t) => ({ ...t, title: e.target.value }))}
                    placeholder="CERTIFICATE OF COMPLETION"
                    className="text-sm font-semibold"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="certSubtitle" className="text-xs font-semibold">
                    Subtitle
                  </Label>
                  <Input
                    id="certSubtitle"
                    value={template.subtitle || ""}
                    onChange={(e) => setTemplate((t) => ({ ...t, subtitle: e.target.value }))}
                    placeholder="This is to certify that"
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="certBody" className="text-xs font-semibold">
                  Challenge / Completion Description
                </Label>
                <Input
                  id="certBody"
                  value={template.bodyText || ""}
                  onChange={(e) => setTemplate((t) => ({ ...t, bodyText: e.target.value }))}
                  placeholder="has successfully completed the 30-day tech skill challenge/training in"
                  className="text-sm"
                />
              </div>

              <div className="flex items-center justify-between pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleResetText}
                  className="text-xs text-muted-foreground"
                >
                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reset to Flier Default Text
                </Button>
              </div>
            </CardContent>
          ) : null}
        </Card>

        {/* 4. Live Certificate Flier Preview */}
        <Card className="glass-card border-primary/30 shadow-lg">
          <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Award className="h-4 w-4 text-primary" /> Live Flier Preview
              </CardTitle>
              <CardDescription className="text-xs">
                Real-time preview of the certificate as clients will view and download it.
              </CardDescription>
            </div>

            {/* Test Participant Controls */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Test Name:</Label>
                <Input
                  value={previewName}
                  onChange={(e) => setPreviewName(e.target.value)}
                  className="h-8 text-xs w-32"
                  placeholder="Sample Name"
                />
              </div>
              <div className="flex items-center gap-1.5">
                <Label className="text-[11px] text-muted-foreground whitespace-nowrap">Test Track:</Label>
                <Input
                  value={previewTrack}
                  onChange={(e) => setPreviewTrack(e.target.value)}
                  className="h-8 text-xs w-36"
                  placeholder="Web Development"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-2">
            <CertificateViewer
              participant={{
                firstName: previewName.split(" ")[0] || "Jane",
                lastName: previewName.split(" ").slice(1).join(" ") || "Doe",
                techSkill: previewTrack,
              }}
              template={template}
              showDownloadButtons={true}
            />
          </CardContent>
        </Card>
      </div>
    </>
  );
}
