import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

/** Both handlers address a manager by its row id, the same value the dashboard already holds. */
export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    let body: { trackName?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const trackName = typeof body.trackName === "string" ? body.trackName.trim() : "";
    if (!trackName) {
      return NextResponse.json({ error: "A learning track must be assigned to the manager." }, { status: 400 });
    }
    const track = await prisma.learningTrack.findUnique({ where: { name: trackName } });
    if (!track) {
      return NextResponse.json({ error: "That learning track does not exist." }, { status: 400 });
    }

    const updatedManager = await prisma.communityManager.update({
      where: { id: params.id },
      data: { trackName: track.name },
    });
    return NextResponse.json({ message: "Manager track updated successfully", data: updatedManager });
  } catch (error) {
    console.error("Update Manager Track Error:", error);
    return NextResponse.json({ error: "Failed to update manager track. They might not exist." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await prisma.communityManager.delete({ where: { id: params.id } });
    return NextResponse.json({ message: "Manager removed successfully." });
  } catch (error) {
    console.error("Delete Manager Error:", error);
    return NextResponse.json({ error: "Failed to delete manager. They might not exist." }, { status: 400 });
  }
}
