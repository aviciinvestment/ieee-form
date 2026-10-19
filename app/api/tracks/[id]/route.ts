import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getAdminAccess } from "@/lib/auth";
import { trackSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
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

    const updatedTrack = await prisma.learningTrack.update({
      where: { id: params.id },
      data: { name, whatsappLink },
    });

    return NextResponse.json({ message: "Learning track updated successfully", data: updatedTrack });
  } catch (error) {
    console.error("Update Track Error:", error);
    return NextResponse.json({ error: "Failed to update learning track. It might not exist." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getAdminAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    await prisma.learningTrack.delete({
      where: { id: params.id },
    });
    return NextResponse.json({ message: "Learning track removed successfully." });
  } catch (error) {
    console.error("Delete Track Error:", error);
    return NextResponse.json({ error: "Failed to delete learning track. It might not exist." }, { status: 400 });
  }
}