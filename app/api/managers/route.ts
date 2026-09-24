import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    const managers = await prisma.communityManager.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: managers });
  } catch (error) {
    console.error("Get Managers Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden: Only the Admin can add managers." }, { status: 403 });
    }

    let body: { email?: string; trackName?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const { email, trackName } = body;
    if (!email || !email.toLowerCase().endsWith("@gmail.com")) {
      return NextResponse.json({ error: "A valid Gmail address is required." }, { status: 400 });
    }

    const existing = await prisma.communityManager.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) {
      return NextResponse.json({ error: "This user is already a community manager." }, { status: 400 });
    }

    const newManager = await prisma.communityManager.create({
      data: { email: email.toLowerCase(), trackName: trackName || "" },
    });

    return NextResponse.json({ message: "Manager added successfully", data: newManager }, { status: 201 });
  } catch (error) {
    console.error("Add Manager Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}