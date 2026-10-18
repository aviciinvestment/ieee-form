import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getManagerAccess } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    const registration = await prisma.registration.findUnique({
      where: { id: params.id },
    });

    if (!registration) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    // Managers can only approve participants in their own track
    if (access.role === "manager" && registration.techSkill !== access.trackName) {
      return NextResponse.json(
        { error: "Forbidden: You can only approve participants in your own track." },
        { status: 403 }
      );
    }

    let approved = true;
    try {
      const body = await req.json();
      if (typeof body.approved === "boolean") {
        approved = body.approved;
      }
    } catch {
      // default to true
    }

    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: {
        approvedForCertificate: approved,
        approvedAt: approved ? new Date() : null,
        approvedBy: approved ? access.email : null,
      },
    });

    return NextResponse.json({
      message: approved
        ? `Certificate approved for ${updated.firstName} ${updated.lastName}`
        : `Certificate approval revoked for ${updated.firstName} ${updated.lastName}`,
      data: updated,
    });
  } catch (error) {
    console.error("Certificate Approval Error:", error);
    return NextResponse.json(
      { error: "Internal server error while updating certificate approval." },
      { status: 500 }
    );
  }
}
