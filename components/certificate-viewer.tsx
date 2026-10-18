"use client";

import { useEffect, useRef, useState } from "react";
import { Download, FileText, Image as ImageIcon, Loader2 } from "lucide-react";
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

export function CertificateViewer({
  participant,
  template,
  showDownloadButtons = true,
}: Props) {
  const certRef = useRef<HTMLDivElement>(null);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);
  const [logoLoadError, setLogoLoadError] = useState(false);
  const [sigLoadError, setSigLoadError] = useState(false);

  useEffect(() => {
    setLogoLoadError(false);
  }, [template.logoUrl]);

  useEffect(() => {
    setSigLoadError(false);
  }, [template.signatureUrl]);

  const candidateName = `${participant.firstName} ${participant.lastName}`.trim() || "Candidate Name";
  const fileBaseName = `${participant.firstName}_${participant.lastName}_Certificate`.replace(/\s+/g, "_");

  async function downloadPNG() {
    if (!certRef.current || downloadingPng) return;
    setDownloadingPng(true);
    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(certRef.current, {
        scale: 3, // 3x resolution for high-definition print quality
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#070a0f",
        windowWidth: 1280,
      });
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
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const canvas = await html2canvas(certRef.current, {
        scale: 3,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#070a0f",
        windowWidth: 1280,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.98);
      // Landscape certificate (297mm x 210mm A4 standard or canvas aspect ratio)
      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [canvas.width / 3, canvas.height / 3],
      });

      pdf.addImage(imgData, "JPEG", 0, 0, canvas.width / 3, canvas.height / 3);
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
      <div className="w-full overflow-hidden rounded-xl shadow-2xl border border-border/40 bg-[#070a0f] mb-4">
        <div
          ref={certRef}
          className="relative w-full aspect-[735/554] select-none text-white overflow-hidden"
          style={{
            backgroundImage: "url('/certificate-base.png')",
            backgroundSize: "cover",
            backgroundPosition: "center",
            backgroundRepeat: "no-repeat",
          }}
        >
          {/* Top Logo Section (Center-aligned with certificate content) */}
          <div className="absolute top-[2%] sm:top-[3%] md:top-[4%] right-[2%] sm:right-[3%] w-[64%] sm:w-[62%] flex items-center justify-center gap-1.5 sm:gap-2.5 z-10 px-2 overflow-hidden text-center">
            {template.logoUrl && !logoLoadError ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={template.logoUrl}
                alt="Logo"
                crossOrigin="anonymous"
                onError={() => setLogoLoadError(true)}
                className="h-3.5 sm:h-5 md:h-7 max-w-[50px] sm:max-w-[90px] md:max-w-[120px] object-contain shrink-0"
              />
            ) : (
              /* Default geometric logo matching the original Alpha Capital symbol */
              <svg
                viewBox="0 0 32 32"
                className="w-3.5 h-3.5 sm:w-4.5 sm:h-4.5 md:w-6 md:h-6 text-white fill-current shrink-0"
              >
                <polygon points="16,2 26,22 22,22 16,10 10,22 6,22" />
                <polygon points="16,14 20,22 12,22" opacity="0.6" />
                <polygon points="16,24 23,30 9,30" opacity="0.85" />
              </svg>
            )}
            <span className="text-[6.5px] sm:text-[9.5px] md:text-sm font-bold uppercase tracking-[0.1em] sm:tracking-[0.2em] text-white/95 truncate text-center">
              {template.logoName || "ALPHA CAPITAL"}
            </span>
          </div>

          {/* Center-Right Certificate Content Column */}
          <div className="absolute top-[13.5%] sm:top-[14%] md:top-[15%] bottom-[10%] sm:bottom-[6%] md:bottom-[6%] right-[2%] sm:right-[3%] w-[64%] sm:w-[62%] flex flex-col items-center justify-between text-center px-1 sm:px-3 md:px-4 z-10">
            {/* Top Group: Badge, Title, Subtitle, Candidate Capsule & Track Pill */}
            <div className="flex flex-col items-center w-full space-y-0.5 sm:space-y-1 md:space-y-1.5">
              {/* Blue Phase Pill Badge */}
              <div className="inline-flex items-center justify-center rounded-[2px] bg-[#0052ff] px-1.5 py-0.5 sm:px-3 sm:py-1 shadow-sm">
                <span className="text-[6.5px] sm:text-[9px] md:text-[11px] font-bold uppercase tracking-wider text-white">
                  {template.badgeText || "PHASE 1"}
                </span>
              </div>

              {/* Title */}
              <h2 className="text-[10px] sm:text-base md:text-2xl lg:text-[28px] font-black tracking-tight text-white leading-[1.2] sm:leading-[1.24] md:leading-[1.28] whitespace-pre-line drop-shadow-sm my-0 sm:my-0.5">
                {template.title || "Certificate\nOf Achievement"}
              </h2>

              {/* Subtitle */}
              <p className="text-[6.5px] sm:text-[9px] md:text-[11.5px] font-normal text-slate-300 tracking-wide leading-tight">
                {template.subtitle || "Proudly presented to"}
              </p>

              {/* Candidate Name Capsule */}
              <div className="w-full max-w-[96%] sm:max-w-md py-1 sm:py-1.5 md:py-2 px-3 sm:px-4 md:px-5 rounded-full bg-black/45 border border-white/20 shadow-[0_0_25px_rgba(255,255,255,0.07)] backdrop-blur-sm transition-all flex items-center justify-center">
                <span className="text-[9px] sm:text-sm md:text-lg lg:text-xl font-bold text-white tracking-wide truncate max-w-full leading-normal">
                  {candidateName}
                </span>
              </div>

              {/* Chosen Learning Track Display */}
              {participant.techSkill ? (
                <div className="inline-flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-0.5 rounded-full bg-white/10 border border-white/20 shadow-sm backdrop-blur-sm">
                  <span className="text-[6px] sm:text-[8px] md:text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan-300 leading-normal">
                    {participant.techSkill} Track
                  </span>
                </div>
              ) : null}
            </div>

            {/* Description Body: Full Text (Reduced spacing, no ellipses) */}
            <div className="w-full max-w-[96%] px-1 sm:px-2">
              <p className="text-[6.8px] sm:text-[8.5px] md:text-[10.5px] lg:text-[11.5px] text-slate-200 leading-[1.36] sm:leading-[1.45] md:leading-[1.5] font-normal">
                {template.bodyText}
              </p>
            </div>

            {/* Footer: Date and Signature Columns */}
            <div className="w-full grid grid-cols-2 gap-2 sm:gap-6 md:gap-8 pt-0 sm:pt-1 pb-0 sm:pb-1">
              {/* Date Column */}
              <div className="flex flex-col items-center justify-end">
                <div className="min-h-[14px] sm:min-h-[22px] md:min-h-[28px] flex items-center justify-center">
                  <span className="font-serif italic text-[7px] sm:text-[10px] md:text-sm text-slate-200 tracking-wide">
                    {template.dateText || "26 Aug 2025"}
                  </span>
                </div>
                <div className="w-14 sm:w-24 md:w-36 h-[0.5px] sm:h-[1px] bg-white/40 my-0.5 sm:my-1" />
                <span className="text-[5.5px] sm:text-[8px] md:text-[10px] font-medium uppercase tracking-wider text-slate-400">
                  Date
                </span>
              </div>

              {/* Signature Column */}
              <div className="flex flex-col items-center justify-end">
                <div className="min-h-[14px] sm:min-h-[22px] md:min-h-[28px] flex items-center justify-center">
                  {template.signatureUrl && !sigLoadError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={template.signatureUrl}
                      alt="Signature"
                      crossOrigin="anonymous"
                      onError={() => setSigLoadError(true)}
                      className="h-3.5 sm:h-5 md:h-7 object-contain filter invert brightness-200"
                    />
                  ) : (
                    /* Default elegant cursive handwritten signature */
                    <span
                      className="text-[8px] sm:text-xs md:text-base lg:text-lg font-normal text-white italic tracking-wider select-none leading-none"
                      style={{
                        fontFamily: "'Brush Script MT', 'Dancing Script', 'Caveat', cursive",
                        transform: "rotate(-3deg)",
                      }}
                    >
                      {template.signatoryName || "George Kohler"}
                    </span>
                  )}
                </div>
                <div className="w-14 sm:w-24 md:w-36 h-[0.5px] sm:h-[1px] bg-white/40 my-0.5 sm:my-1" />
                <span className="text-[5.5px] sm:text-[8px] md:text-[10px] font-medium tracking-wider text-slate-400">
                  {template.signatoryTitle || "Managing Director"}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
