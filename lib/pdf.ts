/**
 * PDF text extraction for AI grading.
 *
 * A participant can answer a subjective question with a PDF and a manager can attach a PDF as the
 * reference answer / extra context. In both cases the text is pulled out of the document and handed to
 * the model, so the page count has to stay inside what the model can actually read in one request.
 */
import { extractText, getDocumentProxy } from "unpdf";

import { downloadPdf, isManagedPdfUrl } from "@/lib/cloudinary";

function positiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : fallback;
}

/** Hard ceiling on pages the AI is asked to analyse in one answer. */
export const MAX_PDF_PAGES = positiveInt(process.env.MAX_PDF_PAGES, 25);
/** Hard ceiling on the upload size so a single submission cannot blow up the server. */
export const MAX_PDF_BYTES = positiveInt(process.env.MAX_PDF_BYTES, 10 * 1024 * 1024);
/** Characters of extracted text kept per document. Roughly 15k tokens. */
export const MAX_PDF_CHARS = positiveInt(process.env.MAX_PDF_CHARS, 60_000);

export type ExtractedPdf = {
  /** Total pages found in the document, even when more exist than we analyse. */
  pageCount: number;
  /** Text of the pages we actually analyse, page 1 first. */
  pages: { page: number; text: string }[];
  /** The analysed pages joined for display and storage. */
  text: string;
  /** True when pages or characters were cut to stay inside the limits. */
  truncated: boolean;
};

export class PdfError extends Error {
  readonly code: "too-many-pages" | "no-text" | "unreadable";

  constructor(code: PdfError["code"], message: string) {
    super(message);
    this.name = "PdfError";
    this.code = code;
  }
}

/**
 * Reads the selectable text of a PDF. Scanned pages without an embedded text layer come back empty,
 * which is reported instead of being graded as a blank answer.
 */
export async function extractPdfText(buffer: Buffer): Promise<ExtractedPdf> {
  let pageTexts: string[];
  let pageCount: number;

  try {
    const document = await getDocumentProxy(new Uint8Array(buffer));
    const result = await extractText(document, { mergePages: false });
    pageCount = result.totalPages;
    pageTexts = result.text.map((page) => page.replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim());
  } catch {
    throw new PdfError("unreadable", "That file could not be read as a PDF.");
  }

  if (pageCount === 0) {
    throw new PdfError("unreadable", "That PDF has no pages.");
  }

  const analysedCount = Math.min(pageCount, MAX_PDF_PAGES);
  const pages: { page: number; text: string }[] = [];
  let characters = 0;
  let truncated = analysedCount < pageCount;

  for (let index = 0; index < analysedCount; index += 1) {
    const pageText = pageTexts[index] ?? "";
    if (!pageText) continue;
    const remaining = MAX_PDF_CHARS - characters;
    if (remaining <= 0) {
      truncated = true;
      break;
    }
    const kept = pageText.slice(0, remaining);
    characters += kept.length;
    if (kept.length < pageText.length) truncated = true;
    pages.push({ page: index + 1, text: kept });
  }

  if (pages.length === 0) {
    throw new PdfError(
      "no-text",
      "No selectable text was found in that PDF. Scanned documents need OCR before they can be graded."
    );
  }

  const body = pages
    .map((entry) => (pages.length > 1 ? `[page ${entry.page}]\n${entry.text}` : entry.text))
    .join("\n\n")
    .slice(0, MAX_PDF_CHARS);

  return { pageCount, pages, text: body, truncated };
}

/** Same limit check the upload route uses, so both entry points behave identically. */
export function assertPdfWithinPageLimit(pageCount: number): void {
  if (pageCount > MAX_PDF_PAGES) {
    throw new PdfError(
      "too-many-pages",
      `That PDF has ${pageCount} pages and the limit is ${MAX_PDF_PAGES}. Upload a shorter document or a part of it.`
    );
  }
}

const referenceCache = new Map<string, ExtractedPdf>();

/**
 * Extracts the text of a PDF already stored in Cloudinary. Repeated lookups of the same document
 * (retrying a save, grading several attempts) reuse the result instead of re-downloading.
 */
export async function extractPdfTextFromCloudinary(secureUrl: string): Promise<ExtractedPdf> {
  const cached = referenceCache.get(secureUrl);
  if (cached) return cached;

  const extracted = await extractPdfText(await downloadPdf(secureUrl));
  if (referenceCache.size > 30) referenceCache.clear();
  referenceCache.set(secureUrl, extracted);
  return extracted;
}

export type QuestionWithReferenceFile = {
  referenceFileUrl?: string;
  referenceFilePages?: number;
  referenceFileText?: string;
};

/** Client supplied extracted text is trimmed and capped so one document cannot flood the model. */
export function sanitizeExtractedText(value: unknown, max = MAX_PDF_CHARS): string {
  if (typeof value !== "string") return "";
  return value
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, max);
}

/**
 * Turns the manager's reference PDF links into page counts and extracted text before a quiz is
 * saved, so grading never has to download a document again.
 *
 * The text produced by the upload request is used when it is supplied. Cloudinary accounts that
 * restrict public delivery answer 401 on a download, so fetching is only a best-effort fallback.
 * Links we did not upload are dropped instead of being fetched.
 */
export async function resolveReferenceFiles<T extends QuestionWithReferenceFile>(
  questions: T[]
): Promise<Array<T & { referenceFilePages: number; referenceFileText: string }>> {
  return Promise.all(
    questions.map(async (question): Promise<T & { referenceFilePages: number; referenceFileText: string }> => {
      const url = (question.referenceFileUrl ?? "").trim();
      const suppliedText = sanitizeExtractedText(question.referenceFileText);
      if (!url) return { ...question, referenceFilePages: 0, referenceFileText: "" };
      if (!isManagedPdfUrl(url)) {
        return { ...question, referenceFileUrl: "", referenceFilePages: 0, referenceFileText: "" };
      }

      const suppliedPages = Number(question.referenceFilePages);
      if (suppliedText) {
        return {
          ...question,
          referenceFilePages: Number.isFinite(suppliedPages) && suppliedPages > 0 ? Math.trunc(suppliedPages) : 1,
          referenceFileText: suppliedText,
        };
      }

      try {
        const extracted = await extractPdfTextFromCloudinary(url);
        assertPdfWithinPageLimit(extracted.pageCount);
        return { ...question, referenceFilePages: extracted.pages.length, referenceFileText: extracted.text };
      } catch (error) {
        console.error("Could not read the reference PDF, saving the question without it:", error);
        return { ...question, referenceFilePages: 0, referenceFileText: "" };
      }
    })
  );
}