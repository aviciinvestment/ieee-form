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
  const nameLength = candidateName.length;

  async function generateCanvas(): Promise<HTMLCanvasElement | null> {
    if (!certRef.current) return null;
    await document.fonts?.ready;

    // Save scroll position and temporarily reset to top-left for perfect html2canvas capture
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    window.scrollTo(0, 0);

    try {
      const html2canvas = (await import("html2canvas")).default;
      const clientWidth = certRef.current.clientWidth || 800;
      // High-resolution scale so output is always ~2400px wide regardless of screen size
      const exportScale = Math.max(2.5, Math.min(4, 2400 / clientWidth));

      const canvas = await html2canvas(certRef.current, {
        scale: exportScale,
        useCORS: true,
        allowTaint: false,
        backgroundColor: "#ffffff",
        scrollX: 0,
        scrollY: 0,
        logging: false,
        onclone: (clonedDoc) => {
          // Resolve exact pixel dimensions based on the live certificate element
          const cw = certRef.current?.clientWidth || 800;

          // 1. Convert underline margin and height to explicit PX values
          // (html2canvas cannot parse 'cqw' units and collapses them to a fraction of a pixel)
          const underline = clonedDoc.querySelector("[data-cert-underline]") as HTMLElement | null;
          if (underline) {
            underline.style.marginTop = `${Math.round(cw * 0.012)}px`;
            underline.style.height = `${Math.max(1.5, Math.round(cw * 0.0016))}px`;
          }

          // 2. Ensure candidate name container is centered and lifted upward above the underline
          const nameContainer = clonedDoc.querySelector("[data-cert-name-container]") as HTMLElement | null;
          if (nameContainer) {
            nameContainer.style.display = "flex";
            nameContainer.style.alignItems = "center";
            nameContainer.style.justifyContent = "center";
            nameContainer.style.minHeight = `${Math.round(cw * 0.044)}px`;
            nameContainer.style.paddingTop = "0px";
            nameContainer.style.paddingBottom = `${Math.round(cw * 0.007)}px`;
          }

          // 3. Stable font metrics for candidate name, pushed upward above underline
          const nameSpan = clonedDoc.querySelector("[data-cert-candidate-name]") as HTMLElement | null;
          if (nameSpan) {
            nameSpan.style.display = "inline-block";
            nameSpan.style.lineHeight = "1.2";
            nameSpan.style.position = "relative";
            nameSpan.style.top = `-${Math.round(cw * 0.005)}px`;
          }

          // 4. Properly spaced challenge text and track title with balanced breathing room
          const challengeText = clonedDoc.querySelector("[data-cert-challenge-text]") as HTMLElement | null;
          if (challengeText) {
            challengeText.style.marginTop = `${Math.round(cw * 0.022)}px`;
            challengeText.style.marginBottom = `${Math.round(cw * 0.015)}px`;
            const paragraphs = challengeText.querySelectorAll("p");
            paragraphs.forEach((p) => {
              p.style.margin = "0px";
              p.style.padding = "0px";
              p.style.lineHeight = "1.3";
            });
          }

          const trackTitle = clonedDoc.querySelector("[data-cert-track-name]") as HTMLElement | null;
          if (trackTitle) {
            trackTitle.style.margin = "0px";
            trackTitle.style.padding = "0px";
            trackTitle.style.lineHeight = "1.15";
          }

          const banner = clonedDoc.querySelector("[data-cert-banner]") as HTMLElement | null;
          if (banner) {
            banner.style.paddingTop = `${Math.round(cw * 0.016)}px`;
            banner.style.paddingBottom = `${Math.round(cw * 0.024)}px`;
          }
        },
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

      const width = canvas.width / 2.5;
      const height = canvas.height / 2.5;

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

  // Sanitize title to avoid legacy Alpha Capital overlapping titles
  const cleanTitle = (template.title && !template.title.includes("Achievement"))
    ? template.title.replace(/\n+/g, " ").trim()
    : "CERTIFICATE OF COMPLETION";

  // Sanitize body text to avoid legacy 280-char paragraph
  const cleanBodyText = (
    template.bodyText &&
    !template.bodyText.includes("evaluation period") &&
    !template.bodyText.includes("disciplined mastery") &&
    template.bodyText.length < 100
  )
    ? template.bodyText
    : "has successfully completed the 30-day tech skill challenge/training in";

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

      {/* Official Certificate Container with Container Query Scaling */}
      <div
        className="w-full overflow-hidden rounded-xl shadow-2xl border border-border/40 bg-white mb-4"
        style={{ containerType: "inline-size" }}
      >
        <div
          ref={certRef}
          data-cert-root
          className="relative w-full aspect-[1000/707] select-none text-slate-900 overflow-hidden flex flex-col justify-between"
          style={{
            containerType: "inline-size",
            background: "linear-gradient(135deg, #dcf0fe 0%, #edf6fe 35%, #ffffff 50%, #e8f4fd 70%, #cfe8fc 100%)",
          }}
        >
          {/* Deep Navy Outer Border Frame */}
          <div
            className="h-full w-full flex flex-col justify-between"
            style={{
              border: "1.3cqw solid #0a235c",
              padding: "0.6cqw",
            }}
          >
            {/* Inner Thin Border Line */}
            <div
              className="relative h-full w-full flex flex-col justify-between"
              style={{
                border: "0.15cqw solid rgba(23, 72, 150, 0.45)",
                padding: "clamp(6px, 1.2cqw, 14px) clamp(8px, 2cqw, 20px) clamp(6px, 0.8cqw, 12px) clamp(8px, 2cqw, 20px)",
                background: "linear-gradient(135deg, rgba(223, 241, 254, 0.6) 0%, rgba(255, 255, 255, 0.95) 50%, rgba(219, 238, 250, 0.6) 100%)",
              }}
            >
              {/* 1. Header Section: Partner Logos & Title */}
              <div className="w-full flex flex-col items-center text-center">
                {/* Logos Row: IEEE on Left, NAU on Right */}
                <div
                  className="flex items-center justify-center"
                  style={{ gap: "clamp(8px, 2.4cqw, 24px)", paddingTop: "clamp(1px, 0.2cqw, 4px)" }}
                >
                  {/* IEEE Logo */}
                  <div className="flex items-center">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/logo.svg"
                      alt="IEEE Logo"
                      crossOrigin="anonymous"
                      style={{ height: "clamp(24px, 4.2cqw, 42px)", width: "auto" }}
                      className="object-contain"
                    />
                  </div>

                  {/* Vertical Divider */}
                  <div
                    style={{
                      height: "clamp(20px, 3.2cqw, 32px)",
                      width: "clamp(1px, 0.12cqw, 1.5px)",
                      backgroundColor: "#cbd5e1",
                    }}
                  />

                  {/* Nnamdi Azikiwe University Logo & Text */}
                  <div
                    className="flex items-center"
                    style={{ gap: "clamp(4px, 0.9cqw, 9px)" }}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src="/download.png"
                      alt="NAU Logo"
                      crossOrigin="anonymous"
                      style={{ height: "clamp(24px, 4.2cqw, 42px)", width: "auto" }}
                      className="object-contain"
                    />
                    <div
                      className="flex flex-col text-left"
                      style={{ lineHeight: 1.15 }}
                    >
                      <span
                        className="font-bold text-[#0a235c] tracking-tight"
                        style={{ fontSize: "clamp(9.5px, 1.2cqw, 13px)" }}
                      >
                        Nnamdi Azikiwe
                      </span>
                      <span
                        className="font-semibold text-[#0a235c]/90"
                        style={{ fontSize: "clamp(8px, 1.0cqw, 11px)" }}
                      >
                        University
                      </span>
                    </div>
                  </div>
                </div>

                {/* Main Heading: CERTIFICATE OF COMPLETION (increased top margin on desktop screen) */}
                <div className="text-center w-full">
                  <h1
                    className="font-black text-[#071739] uppercase drop-shadow-sm text-center whitespace-nowrap mt-[1.6cqw] sm:mt-[3.8cqw] md:mt-[4.8cqw]"
                    style={{
                      fontSize: "clamp(17.5px, 3.85cqw, 39px)",
                      lineHeight: 1.25,
                      letterSpacing: "0.02em",
                      marginBottom: "clamp(2px, 0.4cqw, 6px)",
                    }}
                  >
                    {cleanTitle}
                  </h1>
                  <p
                    className="font-medium text-slate-700 tracking-normal text-center mt-[0.3cqw] mb-[1.2cqw] sm:mb-[1.0cqw] md:mb-[1.2cqw]"
                    style={{
                      fontSize: "clamp(11px, 1.6cqw, 17px)",
                      lineHeight: 1.2,
                    }}
                  >
                    {template.subtitle || "This is to certify that"}
                  </p>
                </div>
              </div>

              {/* 2. Middle Dark Blue Gradient Banner */}
              <div
                data-cert-banner
                className="w-full text-center text-white shadow-md relative"
                style={{
                  background: "linear-gradient(90deg, #071f4e 0%, #0d3b82 45%, #18569c 100%)",
                  padding: "1.6cqw 2cqw 2.2cqw 2cqw",
                  margin: "auto 0",
                }}
              >
                {/* Candidate Name Section with Dedicated Underline Separation */}
                <div
                  className="w-[78%] mx-auto flex flex-col items-center"
                >
                  <div
                    data-cert-name-container
                    className="w-full flex items-center justify-center text-center"
                    style={{
                      minHeight: "clamp(24px, 4.2cqw, 44px)",
                    }}
                  >
                    <span
                      data-cert-candidate-name
                      className="font-bold tracking-wide text-white drop-shadow-sm text-center inline-block"
                      style={{
                        fontSize:
                          nameLength > 28
                            ? "clamp(11px, 2.7cqw, 28px)"
                            : nameLength > 20
                            ? "clamp(13px, 3.3cqw, 33px)"
                            : "clamp(15px, 4.0cqw, 40px)",
                        lineHeight: 1.2,
                      }}
                    >
                      {candidateName}
                    </span>
                  </div>
                  {/* Clean white horizontal line separated from candidate text by explicit margin */}
                  <div
                    data-cert-underline
                    className="w-full bg-white/85"
                    style={{
                      height: "clamp(1.2px, 0.16cqw, 2px)",
                      marginTop: "clamp(8px, 1.2cqw, 13px)",
                    }}
                  />
                </div>

                {/* Exact Flyer Challenge Text in Two Clean Lines (Well-spaced) */}
                <div
                  data-cert-challenge-text
                  className="font-normal text-white/95 max-w-[94%] mx-auto text-center"
                  style={{
                    fontSize: "1.4cqw",
                    lineHeight: 1.3,
                    marginTop: "clamp(10px, 2.0cqw, 22px)",
                    marginBottom: "clamp(8px, 1.5cqw, 16px)",
                  }}
                >
                  <p style={{ margin: 0, padding: 0 }}>has successfully completed the 30-day tech skill</p>
                  <p style={{ margin: 0, padding: 0 }}>challenge/training in</p>
                </div>

                {/* Project Track Title (Elevated with Balanced Bottom Breathing Room) */}
                <h2
                  data-cert-track-name
                  className="font-black uppercase tracking-wider text-white drop-shadow-md text-center"
                  style={{
                    fontSize: "2.4cqw",
                    lineHeight: 1.15,
                    letterSpacing: "0.06em",
                    margin: 0,
                    padding: 0,
                  }}
                >
                  {trackName}
                </h2>
              </div>

              {/* 3. Footer Section: Signatories & Central Medal Rosette Badge */}
              <div
                className="w-full flex items-end justify-between"
                style={{
                  paddingLeft: "clamp(8px, 2cqw, 20px)",
                  paddingRight: "clamp(8px, 2cqw, 20px)",
                  paddingTop: "clamp(3px, 0.4cqw, 6px)",
                  paddingBottom: "clamp(4px, 0.6cqw, 8px)",
                }}
              >
                {/* Left Signature Column */}
                <div
                  className="flex-1 flex flex-col items-center justify-end text-center"
                  style={{ maxWidth: "38%" }}
                >
                  <div
                    className="w-full flex items-end justify-center"
                    style={{
                      height: "clamp(24px, 4.2cqw, 42px)",
                      paddingBottom: "clamp(2px, 0.3cqw, 4px)",
                    }}
                  >
                    {template.signatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={template.signatureUrl}
                        alt="Signature"
                        crossOrigin="anonymous"
                        style={{
                          maxHeight: "clamp(24px, 4.2cqw, 42px)",
                          maxWidth: "clamp(75px, 16cqw, 160px)",
                        }}
                        className="object-contain"
                      />
                    ) : null}
                  </div>
                  <div
                    className="bg-slate-800"
                    style={{
                      width: "clamp(80px, 18cqw, 180px)",
                      height: "clamp(1.2px, 0.15cqw, 2px)",
                    }}
                  />
                  {template.signatoryName ? (
                    <p
                      className="font-bold text-slate-900 leading-tight"
                      style={{
                        fontSize: "clamp(10px, 1.2cqw, 14px)",
                        marginTop: "clamp(3px, 0.35cqw, 5px)",
                      }}
                    >
                      {template.signatoryName}
                    </p>
                  ) : null}
                  {template.signatoryTitle ? (
                    <p
                      className="font-medium text-slate-600 leading-tight"
                      style={{
                        fontSize: "clamp(8.5px, 0.95cqw, 12px)",
                        marginTop: "clamp(2px, 0.15cqw, 3px)",
                      }}
                    >
                      {template.signatoryTitle}
                    </p>
                  ) : null}
                </div>

                {/* Central Rosette Medal Ribbon Badge */}
                <div
                  className="flex flex-col items-center justify-center shrink-0"
                  style={{
                    marginLeft: "clamp(6px, 1.5cqw, 15px)",
                    marginRight: "clamp(6px, 1.5cqw, 15px)",
                  }}
                >
                  <svg
                    viewBox="0 0 100 120"
                    style={{
                      width: "clamp(32px, 5.8cqw, 60px)",
                      height: "clamp(40px, 7.4cqw, 76px)",
                    }}
                    className="drop-shadow-md"
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
                <div
                  className="flex-1 flex flex-col items-center justify-end text-center"
                  style={{ maxWidth: "38%" }}
                >
                  <div
                    className="w-full flex items-end justify-center"
                    style={{
                      height: "clamp(24px, 4.2cqw, 42px)",
                      paddingBottom: "clamp(2px, 0.3cqw, 4px)",
                    }}
                  >
                    {template.signatory2SignatureUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={template.signatory2SignatureUrl}
                        alt="Signature 2"
                        crossOrigin="anonymous"
                        style={{
                          maxHeight: "clamp(24px, 4.2cqw, 42px)",
                          maxWidth: "clamp(75px, 16cqw, 160px)",
                        }}
                        className="object-contain"
                      />
                    ) : null}
                  </div>
                  <div
                    className="bg-slate-800"
                    style={{
                      width: "clamp(80px, 18cqw, 180px)",
                      height: "clamp(1.2px, 0.15cqw, 2px)",
                    }}
                  />
                  {template.signatory2Name ? (
                    <p
                      className="font-bold text-slate-900 leading-tight"
                      style={{
                        fontSize: "clamp(10px, 1.2cqw, 14px)",
                        marginTop: "clamp(3px, 0.35cqw, 5px)",
                      }}
                    >
                      {template.signatory2Name}
                    </p>
                  ) : null}
                  {template.signatory2Title ? (
                    <p
                      className="font-medium text-slate-600 leading-tight"
                      style={{
                        fontSize: "clamp(8.5px, 0.95cqw, 12px)",
                        marginTop: "clamp(2px, 0.15cqw, 3px)",
                      }}
                    >
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
