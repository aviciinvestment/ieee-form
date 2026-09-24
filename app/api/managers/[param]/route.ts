import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function PUT(req: Request, { params }: { params: { param: string } }) {
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

    const { trackName } = body;
    if (!trackName) {
      return NextResponse.json({ error: "A learning track must be assigned to the manager." }, { status: 400 });
    }

    const updatedManager = await prisma.communityManager.update({
      where: { id: params.param },
      data: { trackName },
    });
    return NextResponse.json({ message: "Manager track updated successfully", data: updatedManager });
  } catch (error) {
    console.error("Update Manager Track Error:", error);
    return NextResponse.json({ error: "Failed to update manager track. They might not exist." }, { status: 400 });
  }
}

export async function DELETE(req: Request, { params }: { params: { param: string } }) {
  try {
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden." }, { status: 403 });
    }

    await prisma.communityManager.delete({
      where: { email: params.param.toLowerCase() },
    });
    return NextResponse.json({ message: "Manager removed successfully." });
  } catch (error) {
    console.error("Delete Manager Error:", error);
    return NextResponse.json({ error: "Failed to delete manager. They might not exist." }, { status: 400 });
  }
}