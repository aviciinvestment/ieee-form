import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  const diag: Record<string, unknown> = {
    status: "ok",
    node: process.version,
    hasDatabaseUrl: Boolean(process.env.DATABASE_URL),
    hasDirectUrl: Boolean(process.env.DIRECT_URL),
    hasAdminEmails: Boolean(process.env.ADMIN_EMAILS),
    hasServiceAccountKey: Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_KEY),
  };

  try {
    const { prisma } = await import("@/lib/prisma");
    const count = await prisma.learningTrack.count();
    diag.prisma = { ok: true, trackCount: count };
  } catch (err: unknown) {
    diag.prisma = {
      ok: false,
      error: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : String(err),
    };
  }

  try {
    const authModule = await import("@/lib/auth");
    diag.auth = { ok: true, adminEmails: authModule.getAdminEmails() };
  } catch (err: unknown) {
    diag.auth = {
      ok: false,
      error: err instanceof Error ? { message: err.message, stack: err.stack, name: err.name } : String(err),
    };
  }

  return NextResponse.json(diag);
}