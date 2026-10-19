import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getAdminAccess } from "@/lib/auth";
import { trackSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tracks = await prisma.learningTrack.findMany({
      orderBy: { createdAt: "asc" },
    });
    return NextResponse.json({ data: tracks });
  } catch (error) {
    console.error("Get Tracks Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const access = await getAdminAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = trackSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Validation failed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const { name, whatsappLink } = parsed.data;

    const existing = await prisma.learningTrack.findFirst({
      where: { name: { equals: name, mode: "insensitive" } },
    });
    if (existing) {
      return NextResponse.json({ error: "A learning track with this name already exists." }, { status: 400 });
    }

    const newTrack = await prisma.learningTrack.create({
      data: { name, whatsappLink },
    });

    return NextResponse.json({ message: "Learning track added successfully", data: newTrack }, { status: 201 });
  } catch (error) {
    console.error("Add Track Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}