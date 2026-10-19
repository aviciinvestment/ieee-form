import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ status: "ok", timestamp: new Date().toISOString() });
  } catch (err) {
    console.error("Health check error:", err);
    return NextResponse.json({ status: "unhealthy", error: "Database unreachable" }, { status: 503 });
  }
}