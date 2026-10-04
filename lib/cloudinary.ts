/**
 * Server-side Cloudinary helpers for PDF uploads.
 *
 * The API secret never leaves the server: browsers post the file to our own upload route,
 * which signs and forwards it to Cloudinary. Participants and managers therefore get the same
 * upload path and nobody can use the secret to write to the cloud account directly.
 */

const CLOUDINARY_UPLOAD_URL = (cloudName: string) =>
  `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`;

export type CloudinarySettings = {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
  folder: string;
};

export function cloudinarySettings(): CloudinarySettings | null {
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME?.trim();
  const apiKey = process.env.CLOUDINARY_API_KEY?.trim();
  const apiSecret = process.env.CLOUDINARY_API_SECRET?.trim();
  if (!cloudName || !apiKey || !apiSecret) return null;
  return {
    cloudName,
    apiKey,
    apiSecret,
    folder: process.env.CLOUDINARY_UPLOAD_FOLDER?.trim() || "ieee-quiz-pdfs",
  };
}

export function isCloudinaryConfigured(): boolean {
  return cloudinarySettings() !== null;
}

/**
 * Only our own delivery host is accepted, so a crafted URL cannot make the server fetch
 * an arbitrary file from the internet.
 */
export function isManagedPdfUrl(value: unknown): value is string {
  const settings = cloudinarySettings();
  if (!settings || typeof value !== "string") return false;
  const url = value.trim();
  if (!url.startsWith("https://")) return false;
  return url.startsWith(`https://res.cloudinary.com/${settings.cloudName}/`) && url.toLowerCase().endsWith(".pdf");
}

async function sha1(value: string): Promise<string> {
  const { createHash } = await import("node:crypto");
  return createHash("sha1").update(value).digest("hex");
}

function publicIdFor(fileName: string): string {
  const base = fileName
    .replace(/\.pdf$/i, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
    .toLowerCase();
  return `${base || "document"}-${Date.now().toString(36)}`;
}

export type UploadedPdf = {
  publicId: string;
  secureUrl: string;
  bytes: number;
};

/** Uploads a PDF to Cloudinary as an image asset so it is delivered as application/pdf. */
export async function uploadPdf(buffer: Buffer, fileName: string): Promise<UploadedPdf> {
  const settings = cloudinarySettings();
  if (!settings) {
    throw new Error("PDF uploads are not configured. Add the Cloudinary variables to .env.");
  }

  const timestamp = Math.floor(Date.now() / 1000);
  const publicId = publicIdFor(fileName);
  const signature = await sha1(
    `folder=${settings.folder}&public_id=${publicId}&timestamp=${timestamp}${settings.apiSecret}`
  );

  const form = new FormData();
  form.set("file", new Blob([new Uint8Array(buffer)], { type: "application/pdf" }), fileName);
  form.set("api_key", settings.apiKey);
  form.set("timestamp", String(timestamp));
  form.set("folder", settings.folder);
  form.set("public_id", publicId);
  form.set("signature", signature);

  const res = await fetch(CLOUDINARY_UPLOAD_URL(settings.cloudName), { method: "POST", body: form });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Cloudinary upload failed with ${res.status}: ${text.slice(0, 200)}`);
  }

  const payload = JSON.parse(text) as { secure_url?: string; public_id?: string; bytes?: number };
  if (!payload.secure_url || !payload.public_id) {
    throw new Error("Cloudinary upload returned an unexpected response.");
  }

  return { publicId: payload.public_id, secureUrl: payload.secure_url, bytes: payload.bytes ?? buffer.length };
}

export async function deletePdf(publicId: string): Promise<void> {
  const settings = cloudinarySettings();
  if (!settings || !publicId.startsWith(`${settings.folder}/`)) return;

  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await sha1(`public_id=${publicId}&timestamp=${timestamp}${settings.apiSecret}`);
  const form = new FormData();
  form.set("public_id", publicId);
  form.set("api_key", settings.apiKey);
  form.set("timestamp", String(timestamp));
  form.set("signature", signature);

  // A failed cleanup must never break the request that triggered it.
  await fetch(`https://api.cloudinary.com/v1_1/${settings.cloudName}/image/destroy`, {
    method: "POST",
    body: form,
  }).catch(() => undefined);
}

/** Downloads a PDF we uploaded earlier so its text can be extracted for grading. */
export async function downloadPdf(secureUrl: string): Promise<Buffer> {
  if (!isManagedPdfUrl(secureUrl)) {
    throw new Error("That PDF link is not a managed Cloudinary upload.");
  }

  const res = await fetch(secureUrl);
  if (!res.ok) {
    throw new Error(`Could not download the PDF (${res.status}).`);
  }
  return Buffer.from(await res.arrayBuffer());
}