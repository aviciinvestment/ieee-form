"use client";

import { useRef, useState } from "react";
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

export function CertificateViewer({
  participant,
  template,
  showDownloadButtons = true,
}: Props) {
  const certRef = useRef<HTMLDivElement>(null);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [downloadingPdf, setDownloadingPdf] = useState(false);

  const candidateName = `${participant.firstName || ""} ${participant.lastName || ""}`.trim() || "Participant Name";
  const trackName = (participant.techSkill || template.defaultTrack || "WEB DEVELOPMENT").toUpperCase();
  const fileBaseName = `${participant.firstName || "Certificate"}_${participant.lastName || ""}_Certificate`.replace(/\s+/g, "_");

  // Dynamic font sizing for long candidate names
  const nameLength = candidateName.length;
  const nameClass = nameLength > 28
    ? "text-xs sm:text-base md:text-xl lg:text-2xl"
    : nameLength > 20
    ? "text-sm sm:text-lg md:text-2xl lg:text-3xl"
    : "text-base sm:text-xl md:text-3xl lg:text-[34px]";

  async function generateCanvas(): Promise<HTMLCanvasElement | null> {
    if (!certRef.current) return null;
    await document.fonts?.ready;

    // Save scroll position and temporarily reset to top-left for perfect html2canvas capture
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const canvas = await html2canvas(certRef.current, {
        scale: 3, // 3x ultra-sharp print quality
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        logging: false,
      });
      return canvas;
    } finally {
      window.scrollTo(scrollX, scrollY);
    }
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

      const width = canvas.width / 3;
      const height = canvas.height / 3;

      const pdf = new jsPDF({
        orientation: "landscape",
        unit: "px",
        format: [width, height],
      });

      pdf.addImage(imgData, "PNG", 0, 0, width, height);
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

      {/* Official Certificate Container */}
      <div className="w-full overflow-hidden rounded-xl shadow-2xl border border-border/40 bg-white mb-4">
        <div
          ref={certRef}
          className="relative w-full aspect-[1000/710] select-none text-slate-900 overflow-hidden flex flex-col justify-between"
          style={{
            background: "linear-gradient(135deg, #dcf0fe 0%, #edf6fe 35%, #ffffff 50%, #e8f4fd 70%, #cfe8fc 100%)",
          }}
        >
          {/* Deep Navy Outer Border Frame */}
          <div className="h-full w-full p-2.5 sm:p-4 md:p-5 flex flex-col justify-between border-[8px] sm:border-[12px] md:border-[18px] border-[#0a235c]">
            {/* Inner Thin Border Line */}
            <div className="relative h-full w-full flex flex-col justify-between border border-[#174896]/50 p-2 sm:p-4 md:p-6 bg-gradient-to-br from-[#dff1fe]/60 via-white/95 to-[#dbeefa]/60">

              {/* 1. Header Section: Logos & Title */}
              <div className="w-full flex flex-col items-center text-center space-y-1 sm:space-y-2">
                {/* Partner Logos: IEEE on left, Nnamdi Azikiwe University on right */}
                <div className="flex items-center justify-center gap-4 sm:gap-6 md:gap-8 pt-0.5 sm:pt-1">
                  {/* IEEE Logo */}
                  <div className="flex items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo.svg"
                      alt="IEEE Logo"
                      crossOrigin="anonymous"
                      className="h-6 sm:h-9 md:h-12 w-auto object-contain"
                    />
                  </div>

                  {/* Vertical Divider */}
                  <div className="h-6 sm:h-8 md:h-10 w-[1px] bg-slate-300" />

                  {/* Nnamdi Azikiwe University Logo & Text */}
                  <div className="flex items-center gap-1.5 sm:gap-2.5">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/download.png"
                      alt="NAU Logo"
                      crossOrigin="anonymous"
                      className="h-6 sm:h-9 md:h-12 w-auto object-contain"
                    />
                    <div className="flex flex-col text-left leading-tight">
                      <span className="text-[10px] sm:text-xs md:text-sm font-bold text-[#0a235c] tracking-tight">
                        Nnamdi Azikiwe
                      </span>
                      <span className="text-[9px] sm:text-[11px] md:text-xs font-semibold text-[#0a235c]/90">
                        University
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Heading */}
                <div className="text-center pt-1 sm:pt-2 space-y-0.5 sm:space-y-1">
                  <h1 className="text-base sm:text-2xl md:text-3xl lg:text-[34px] font-black tracking-tight text-[#071739] uppercase drop-shadow-sm leading-tight">
                    {template.title || "CERTIFICATE OF COMPLETION"}
                  </h1>
                  <p className="text-[9.5px] sm:text-xs md:text-sm font-medium text-slate-700 tracking-normal">
                    {template.subtitle || "This is to certify that"}
                  </p>
                </div>
              </div>

              {/* 2. Middle Dark Blue Gradient Banner */}
              <div
                className="w-full my-auto py-2.5 sm:py-4 md:py-5 px-3 sm:px-6 md:px-8 text-center text-white shadow-md relative"
                style={{
                  background: "linear-gradient(90deg, #071f4e 0%, #0d3b82 45%, #18569c 100%)",
                }}
              >
                {/* Candidate Name Section */}
                <div className="w-full max-w-[82%] mx-auto pb-0.5 sm:pb-1 mb-1 sm:mb-2 relative">
                  <div className="min-h-[20px] sm:min-h-[32px] md:min-h-[40px] flex items-end justify-center pb-0.5">
                    <span className={`${nameClass} font-bold tracking-wide text-white drop-shadow-sm`}>
                      {candidateName}
                    </span>
                  </div>
                  {/* Underline for candidate name */}
                  <div className="w-full h-[1px] sm:h-[1.5px] bg-white/70" />
                </div>

                {/* Description Text */}
                <p className="text-[8px] sm:text-[11px] md:text-xs lg:text-sm font-normal text-white/95 max-w-[94%] mx-auto leading-tight my-1 sm:my-1.5">
                  {template.bodyText || "has successfully completed the 30-day tech skill challenge/training in"}
                </p>

                {/* Project Track (Automatically Placed for each individual client) */}
                <h2 className="text-xs sm:text-base md:text-xl lg:text-2xl font-black uppercase tracking-wider text-white drop-shadow-md pt-0.5">
                  {trackName}
                </h2>
              </div>

              {/* 3. Footer Section: Signatories & Medal Rosette Badge */}
              <div className="w-full flex items-end justify-between px-2 sm:px-6 md:px-10 pb-0.5 sm:pb-1 pt-1 sm:pt-2">
                {/* Left Signature Column */}
                <div className="flex-1 flex flex-col items-center justify-end text-center max-w-[38%]">
                  <div className="h-6 sm:h-9 md:h-12 w-full flex items-end justify-center pb-1">
                    {template.signatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={template.signatureUrl}
                        alt="Signature"
                        crossOrigin="anonymous"
                        className="max-h-6 sm:max-h-9 md:max-h-12 max-w-[100px] sm:max-w-[140px] md:max-w-[170px] object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="w-24 sm:w-36 md:w-48 h-[1px] sm:h-[1.5px] bg-slate-800" />
                  {template.signatoryName ? (
                    <p className="text-[7.5px] sm:text-[10px] md:text-xs font-bold text-slate-900 mt-1 leading-tight">
                      {template.signatoryName}
                    </p>
                  ) : null}
                  {template.signatoryTitle ? (
                    <p className="text-[6.5px] sm:text-[9px] md:text-[11px] font-medium text-slate-600 leading-tight">
                      {template.signatoryTitle}
                    </p>
                  ) : null}
                </div>

                {/* Central Rosette Medal Ribbon Badge */}
                <div className="flex flex-col items-center justify-center shrink-0 mx-2 sm:mx-4">
                  <svg
                    viewBox="0 0 100 120"
                    className="w-8 h-10 sm:w-11 sm:h-13 md:w-14 md:h-16 drop-shadow-md"
                  >
                    {/* Ribbon Tails */}
                    <g>
                      <path d="M38 68 L28 112 L43 104 L46 112 L48 70 Z" fill="#0d3b82" />
                      <path d="M48 70 L50 112 L53 104 L68 112 L58 68 Z" fill="#18569c" />
                    </g>
                    {/* Outer Rosette Cogs */}
                    <path
                      d="M50 6 L53 14 L62 10 L63 19 L72 18 L70 27 L79 29 L75 38 L83 43 L76 50 L83 57 L75 62 L79 71 L70 73 L72 82 L63 81 L62 90 L53 86 L50 94 L47 86 L38 90 L37 81 L28 82 L30 73 L21 71 L25 62 L17 57 L24 50 L17 43 L25 38 L21 29 L30 27 L28 18 L37 19 L38 10 L47 14 Z"
                      fill="#18569c"
                    />
                    {/* Rosette Body */}
                    <circle cx="50" cy="50" r="32" fill="#0d3b82" />
                    {/* White Dotted Ring */}
                    <circle cx="50" cy="50" r="28" fill="none" stroke="#ffffff" strokeWidth="1.5" strokeDasharray="3 2" />
                    {/* Inner Center */}
                    <circle cx="50" cy="50" r="23" fill="#134785" />
                  </svg>
                </div>

                {/* Right Signature Column */}
                <div className="flex-1 flex flex-col items-center justify-end text-center max-w-[38%]">
                  <div className="h-6 sm:h-9 md:h-12 w-full flex items-end justify-center pb-1">
                    {template.signatory2SignatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={template.signatory2SignatureUrl}
                        alt="Signature 2"
                        crossOrigin="anonymous"
                        className="max-h-6 sm:max-h-9 md:max-h-12 max-w-[100px] sm:max-w-[140px] md:max-w-[170px] object-contain"
                      />
                    ) : null}
                  </div>
                  <div className="w-24 sm:w-36 md:w-48 h-[1px] sm:h-[1.5px] bg-slate-800" />
                  {template.signatory2Name ? (
                    <p className="text-[7.5px] sm:text-[10px] md:text-xs font-bold text-slate-900 mt-1 leading-tight">
                      {template.signatory2Name}
                    </p>
                  ) : null}
                  {template.signatory2Title ? (
                    <p className="text-[6.5px] sm:text-[9px] md:text-[11px] font-medium text-slate-600 leading-tight">
                      {template.signatory2Title}
                    </p>
                  ) : null}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
