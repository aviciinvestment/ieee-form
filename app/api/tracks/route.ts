import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin } from "@/lib/auth";

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
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden: Only the Admin can add learning tracks." }, { status: 403 });
    }

    let body: { name?: string; whatsappLink?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { name, whatsappLink } = body;
    if (!name || !whatsappLink) {
      return NextResponse.json({ error: "Track name and WhatsApp group link are required." }, { status: 400 });
    }

    const existing = await prisma.learningTrack.findUnique({ where: { name } });
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