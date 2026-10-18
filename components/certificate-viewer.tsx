"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { FileText, Image as ImageIcon, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CertificateTemplate } from "@/lib/types";

export type CertificateParticipant = {
  firstName: string;
  lastName: string;
  email?: string;
  techSkill?: string;
};

type Props = {
  participant: CertificateParticipant;
  template: CertificateTemplate;
  showDownloadButtons?: boolean;
};

const BASE_WIDTH = 735;
const BASE_HEIGHT = 554;

export function CertificateViewer({
  participant,
  template,
  showDownloadButtons = true,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const certRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState(1);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [sigLoadError, setSigLoadError] = useState(false);

  // Keep preview responsive and proportionally scaled
  const updateScale = useCallback(() => {
    if (!containerRef.current) return;
    const width = containerRef.current.clientWidth;
    if (width > 0) {
      setScale(width / BASE_WIDTH);
    }
  }, []);

  useEffect(() => {
    updateScale();
    const el = containerRef.current;
    if (!el) return;

    const ro = new ResizeObserver(updateScale);
    ro.observe(el);
    window.addEventListener("resize", updateScale);

    return () => {
      ro.disconnect();
      window.removeEventListener("resize", updateScale);
    };
  }, [updateScale]);

  useEffect(() => {
    setLogoLoadError(false);
  }, [template.logoUrl]);

  useEffect(() => {
    setSigLoadError(false);
  }, [template.signatureUrl]);

  const candidateName = `${participant.firstName} ${participant.lastName}`.trim() || "Candidate Name";
  const fileBaseName = `${participant.firstName}_${participant.lastName}_Certificate`.replace(/\s+/g, "_");

  // Dynamic font sizing for candidate name to avoid any truncation or text wrapping issues
  const nameLength = candidateName.length;
  const nameFontSize = nameLength > 28 ? 13 : nameLength > 22 ? 15 : 17;
  const nameLineHeight = nameLength > 28 ? 19 : nameLength > 22 ? 21 : 24;

  async function generateCanvas(): Promise<HTMLCanvasElement | null> {
    if (!certRef.current) return null;
    await document.fonts?.ready;
    const html2canvas = (await import("html2canvas")).default;

    return await html2canvas(certRef.current, {
      scale: 2.5, // 2.5x gives 1837 x 1385 print-quality resolution
      useCORS: true,
      allowTaint: false,
      backgroundColor: "#070a0f",
      scrollX: 0,
      scrollY: 0,
      x: 0,
      y: 0,
      width: BASE_WIDTH,
      height: BASE_HEIGHT,
      windowWidth: BASE_WIDTH,
      windowHeight: BASE_HEIGHT,
      onclone: (clonedDoc, clonedEl) => {
        // Reset any parent constraints in the cloned iframe so nothing clips or shifts
        clonedDoc.body.style.width = `${BASE_WIDTH}px`;
        clonedDoc.body.style.height = `${BASE_HEIGHT}px`;
        clonedDoc.body.style.margin = "0";
        clonedDoc.body.style.padding = "0";
        clonedDoc.body.style.overflow = "visible";

        let parent = clonedEl.parentElement;
        while (parent && parent !== clonedDoc.body) {
          parent.style.width = `${BASE_WIDTH}px`;
          parent.style.maxWidth = "none";
          parent.style.height = `${BASE_HEIGHT}px`;
          parent.style.maxHeight = "none";
          parent.style.padding = "0";
          parent.style.margin = "0";
          parent.style.overflow = "visible";
          parent.style.transform = "none";
          parent = parent.parentElement;
        }

        // Render the cloned certificate cleanly at exact 1:1 scale
        clonedEl.style.transform = "none";
        clonedEl.style.position = "absolute";
        clonedEl.style.top = "0";
        clonedEl.style.left = "0";
        clonedEl.style.width = `${BASE_WIDTH}px`;
        clonedEl.style.height = `${BASE_HEIGHT}px`;
        clonedEl.style.margin = "0";
        clonedEl.style.overflow = "hidden";
      },
    });
  }

  async function downloadPNG() {
    if (!certRef.current || downloadingPng) return;
    setDownloadingPng(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) {
        throw new Error("Could not create canvas.");
      }
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `${fileBaseName}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error("PNG download error:", err);
      alert("Could not generate PNG download. Please try again.");
    } finally {
      setDownloadingPng(false);
    }
  }

  async function downloadPDF() {
    if (!certRef.current || downloadingPdf) return;
    setDownloadingPdf(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) {
        throw new Error("Could not create canvas.");
      }
      const { jsPDF } = await import("jspdf");
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [BASE_WIDTH, BASE_HEIGHT],
      });

      pdf.addImage(imgData, "PNG", 0, 0, BASE_WIDTH, BASE_HEIGHT);
      pdf.save(`${fileBaseName}.pdf`);
    } catch (err) {
      console.error("PDF download error:", err);
      alert("Could not generate PDF download. Please try again.");
    } finally {
      setDownloadingPdf(false);
    }
  }

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-4 pb-8 mb-6">
      {/* Action Download Buttons */}
      {showDownloadButtons ? (
        <div className="flex flex-wrap items-center justify-end w-full gap-3 px-1">
          <Button
            onClick={downloadPNG}
            disabled={downloadingPng || downloadingPdf}
            variant="outline"
            className="border-primary/40 bg-background/80 hover:bg-primary/10 transition-colors shadow-sm text-xs sm:text-sm"
          >
            {downloadingPng ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="mr-2 h-4 w-4 text-primary" />
            )}
            Download PNG
          </Button>

          <Button
            onClick={downloadPDF}
            disabled={downloadingPdf || downloadingPng}
            className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-md transition-all text-xs sm:text-sm"
          >
            {downloadingPdf ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileText className="mr-2 h-4 w-4" />
            )}
            Download PDF
          </Button>
        </div>
      ) : null}

      {/* Responsive certificate container */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[735/554] overflow-hidden rounded-xl shadow-2xl border border-border/40 bg-[#070a0f] mb-4"
      >
        <div
          ref={certRef}
          id="official-certificate-canvas"
          style={{
            width: BASE_WIDTH,
            height: BASE_HEIGHT,
            transform: `scale(${scale})`,
            transformOrigin: "top left",
            backgroundImage: "url('/certificate-base.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
          className="absolute top-0 left-0 select-none text-white overflow-hidden pointer-events-auto"
        >
          {/* Top Logo Section (Aligned with center-right content area) */}
          <div
            style={{
              position: "absolute",
              top: "18px",
              right: "18px",
              width: "456px",
              height: "28px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              zIndex: 10,
            }}
          >
            {template.logoUrl && !logoLoadError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.logoUrl}
                alt="Logo"
                crossOrigin="anonymous"
                onError={() => setLogoLoadError(true)}
                style={{
                  maxHeight: "22px",
                  maxWidth: "120px",
                  objectFit: "contain",
                  flexShrink: 0,
                }}
              />
            ) : (
              /* Default geometric logo matching the original Alpha Capital symbol */
              <svg
                viewBox="0 0 32 32"
                style={{
                  width: "20px",
                  height: "20px",
                  color: "#ffffff",
                  fill: "currentColor",
                  flexShrink: 0,
                }}
              >
                <polygon points="16,2 26,22 22,22 16,10 10,22 6,22" />
                <polygon points="16,14 20,22 12,22" opacity="0.6" />
                <polygon points="16,24 23,30 9,30" opacity="0.85" />
              </svg>
            )}
            <span
              style={{
                fontSize: "11px",
                fontWeight: 700,
                letterSpacing: "0.18em",
                textTransform: "uppercase",
                color: "rgba(255, 255, 255, 0.95)",
                lineHeight: "18px",
                padding: "0 2px",
                whiteSpace: "nowrap",
              }}
            >
              {template.logoName || "ALPHA CAPITAL"}
            </span>
          </div>

          {/* Main Content Area (Column on the right side) */}
          <div
            style={{
              position: "absolute",
              top: "60px",
              right: "18px",
              width: "456px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              textAlign: "center",
              zIndex: 10,
            }}
          >
            {/* Phase Badge */}
            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                borderRadius: "3px",
                backgroundColor: "#0052ff",
                padding: "2px 10px",
                boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
              }}
            >
              <span
                style={{
                  fontSize: "9px",
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase",
                  color: "#ffffff",
                  lineHeight: "14px",
                }}
              >
                {template.badgeText || "PHASE 1"}
              </span>
            </div>

            {/* Certificate Title */}
            <h2
              style={{
                fontSize: "23px",
                lineHeight: "29px",
                fontWeight: 900,
                letterSpacing: "-0.01em",
                color: "#ffffff",
                whiteSpace: "pre-line",
                textAlign: "center",
                margin: "8px 0 4px 0",
                padding: "2px 0",
                textShadow: "0 2px 8px rgba(0, 0, 0, 0.5)",
              }}
            >
              {template.title || "Certificate\nOf Achievement"}
            </h2>

            {/* Subtitle */}
            <p
              style={{
                fontSize: "10.5px",
                lineHeight: "15px",
                fontWeight: 400,
                color: "#cbd5e1",
                letterSpacing: "0.04em",
                textAlign: "center",
                margin: "0 0 7px 0",
              }}
            >
              {template.subtitle || "Proudly presented to"}
            </p>

            {/* Candidate Name Capsule */}
            <div
              style={{
                width: "380px",
                maxWidth: "96%",
                padding: "6px 20px",
                borderRadius: "9999px",
                backgroundColor: "rgba(0, 0, 0, 0.65)",
                border: "1px solid rgba(255, 255, 255, 0.25)",
                boxShadow: "0 4px 16px rgba(0, 0, 0, 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 0 6px 0",
              }}
            >
              <span
                style={{
                  fontSize: `${nameFontSize}px`,
                  lineHeight: `${nameLineHeight}px`,
                  fontWeight: 700,
                  letterSpacing: "0.02em",
                  color: "#ffffff",
                  textAlign: "center",
                  padding: "1px 0",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "100%",
                }}
              >
                {candidateName}
              </span>
            </div>

            {/* Chosen Learning Track Display */}
            {participant.techSkill ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2px 12px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(255, 255, 255, 0.08)",
                  border: "1px solid rgba(255, 255, 255, 0.2)",
                  margin: "0 0 7px 0",
                }}
              >
                <span
                  style={{
                    fontSize: "8.5px",
                    lineHeight: "13px",
                    fontWeight: 600,
                    letterSpacing: "0.14em",
                    textTransform: "uppercase",
                    color: "#67e8f9",
                  }}
                >
                  {participant.techSkill} Track
                </span>
              </div>
            ) : null}

            {/* Description Body Text */}
            <div
              style={{
                width: "410px",
                maxWidth: "96%",
                padding: "2px 4px",
                margin: "2px 0 0 0",
              }}
            >
              <p
                style={{
                  fontSize: "9.5px",
                  lineHeight: "15.5px",
                  fontWeight: 400,
                  color: "#e2e8f0",
                  textAlign: "center",
                  margin: 0,
                }}
              >
                {template.bodyText}
              </p>
            </div>
          </div>

          {/* Footer: Date and Signature Columns (Anchored at the bottom) */}
          <div
            style={{
              position: "absolute",
              bottom: "26px",
              right: "18px",
              width: "456px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "32px",
              padding: "0 20px",
              boxSizing: "border-box",
              zIndex: 10,
            }}
          >
            {/* Date Column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  height: "26px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <span
                  style={{
                    fontFamily: "serif",
                    fontStyle: "italic",
                    fontSize: "11.5px",
                    lineHeight: "16px",
                    color: "#e2e8f0",
                    letterSpacing: "0.02em",
                  }}
                >
                  {template.dateText || "26 Aug 2025"}
                </span>
              </div>
              <div
                style={{
                  width: "120px",
                  height: "1px",
                  backgroundColor: "rgba(255, 255, 255, 0.4)",
                  margin: "4px 0 3px 0",
                }}
              />
              <span
                style={{
                  fontSize: "8px",
                  lineHeight: "12px",
                  fontWeight: 600,
                  textTransform: "uppercase",
                  letterSpacing: "0.1em",
                  color: "#94a3b8",
                }}
              >
                Date
              </span>
            </div>

            {/* Signature Column */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "flex-end",
              }}
            >
              <div
                style={{
                  height: "26px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {template.signatureUrl && !sigLoadError ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={template.signatureUrl}
                    alt="Signature"
                    crossOrigin="anonymous"
                    onError={() => setSigLoadError(true)}
                    style={{
                      height: "26px",
                      objectFit: "contain",
                      filter: "invert(1) brightness(2)",
                    }}
                  />
                ) : (
                  <span
                    style={{
                      fontSize: "16px",
                      lineHeight: "22px",
                      fontFamily:
                        "'Brush Script MT', 'Segoe Script', 'Caveat', 'Dancing Script', cursive",
                      fontStyle: "italic",
                      letterSpacing: "0.04em",
                      color: "#ffffff",
                      padding: "0 6px",
                      display: "inline-block",
                      userSelect: "none",
                    }}
                  >
                    {template.signatoryName || "George Kohler"}
                  </span>
                )}
              </div>
              <div
                style={{
                  width: "120px",
                  height: "1px",
                  backgroundColor: "rgba(255, 255, 255, 0.4)",
                  margin: "4px 0 3px 0",
                }}
              />
              <span
                style={{
                  fontSize: "8px",
                  lineHeight: "12px",
                  fontWeight: 500,
                  letterSpacing: "0.04em",
                  color: "#94a3b8",
                }}
              >
                {template.signatoryTitle || "Managing Director"}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
