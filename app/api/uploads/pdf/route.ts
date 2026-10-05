import { NextResponse } from "next/server";

import { accessDeniedResponse, getManagerAccess, getParticipantAccess, getRequestEmail } from "@/lib/auth";
import { isCloudinaryConfigured, uploadPdf } from "@/lib/cloudinary";
import { assertPdfWithinPageLimit, extractPdfText, MAX_PDF_BYTES, MAX_PDF_PAGES, PdfError } from "@/lib/pdf";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_UPLOADS_PER_HOUR = 40;

/** Managers and participants both upload through here; nothing else may call the upload. */
async function canUpload(req: Request): Promise<{ ok: true; role: "admin" | "manager" | "participant" } | { ok: false; status: number; error: string; code?: string }> {
  if (!getRequestEmail(req)) {
    return { ok: false, status: 401, error: "Unauthorized: Missing email authentication header." };
  }

  const manager = await getManagerAccess(req);
  if (manager.ok) return { ok: true, role: manager.role };
  if (manager.status === 403) {
    // Not a manager, but registered participants can answer with a PDF.
    const participant = await getParticipantAccess(req);
    if (participant.ok) return { ok: true, role: "participant" };
    return { ok: false, status: 403, error: "Forbidden: only the main admin, track managers and registered participants can upload a PDF." };
  }

  return manager;
}

/**
 * POST /api/uploads/pdf
 * Body: multipart/form-data with a single "file" field holding a PDF.
 * Stores the document in Cloudinary and returns the link plus the text the AI will analyse,
 * so the editor can show page and character counts immediately.
 */
export async function POST(req: Request) {
  try {
    const access = await canUpload(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    if (!isCloudinaryConfigured()) {
      return NextResponse.json(
        { error: "PDF uploads are not configured on this server." },
        { status: 503 }
      );
    }

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return NextResponse.json({ error: "Send the PDF as multipart/form-data." }, { status: 400 });
    }

    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file was uploaded." }, { status: 400 });
    }

    const fileName = (file.name || "document.pdf").trim();
    if (!/\.pdf$/i.test(fileName) && file.type !== "application/pdf") {
      return NextResponse.json({ error: "Only PDF files are accepted." }, { status: 415 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "That PDF is empty." }, { status: 400 });
    }
    if (file.size > MAX_PDF_BYTES) {
      return NextResponse.json(
        { error: `That PDF is ${(file.size / 1024 / 1024).toFixed(1)}MB. The limit is ${(MAX_PDF_BYTES / 1024 / 1024).toFixed(0)}MB.` },
        { status: 413 }
      );
    }
    if (MAX_UPLOADS_PER_HOUR > 0) {
      // Cheap abuse guard: one upload per second is enough for a human.
      const key = `upload:${access.role}:${getRequestEmail(req)}`;
      const bucket = (globalThis as { __pdfUploadBuckets?: Map<string, { count: number; resetAt: number }> }).__pdfUploadBuckets
        ?? ((globalThis as { __pdfUploadBuckets?: Map<string, { count: number; resetAt: number }> }).__pdfUploadBuckets = new Map());
      const now = Date.now();
      const entry = bucket.get(key);
      if (!entry || entry.resetAt < now) {
        bucket.set(key, { count: 1, resetAt: now + 3_600_000 });
      } else if (entry.count >= MAX_UPLOADS_PER_HOUR) {
        return NextResponse.json({ error: "Too many PDF uploads. Try again later." }, { status: 429 });
      } else {
        entry.count += 1;
      }
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    let extracted;
    try {
      extracted = await extractPdfText(buffer);
      assertPdfWithinPageLimit(extracted.pageCount);
    } catch (error) {
      if (error instanceof PdfError) {
        const status = error.code === "too-many-pages" ? 422 : 400;
        return NextResponse.json({ error: error.message }, { status });
      }
      throw error;
    }

    let uploaded;
    try {
      uploaded = await uploadPdf(buffer, fileName);
    } catch (error) {
      console.error("PDF Upload Error:", error);
      return NextResponse.json(
        { error: "The PDF could not be stored. Please try again." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      message: "PDF uploaded successfully",
      data: {
        url: uploaded.secureUrl,
        publicId: uploaded.publicId,
        fileName: fileName.replace(/\.pdf$/i, ""),
        bytes: uploaded.bytes,
        pageCount: extracted.pageCount,
        pagesAnalysed: extracted.pages.length,
        characters: extracted.text.length,
        truncated: extracted.truncated,
        maxPages: MAX_PDF_PAGES,
        text: extracted.text,
      },
    });
  } catch (error) {
    console.error("Upload PDF Error:", error);
    return NextResponse.json({ error: "Internal server error while uploading the PDF." }, { status: 500 });
  }
}