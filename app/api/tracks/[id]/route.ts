import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden: Only the Admin can edit learning tracks." }, { status: 403 });
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
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden: Only the Admin can delete learning tracks." }, { status: 403 });
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