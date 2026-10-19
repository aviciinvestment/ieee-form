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

    const existingTrack = await prisma.learningTrack.findUnique({ where: { id: params.id } });
    if (!existingTrack) {
      return NextResponse.json({ error: "Learning track not found." }, { status: 404 });
    }

    if (existingTrack.name !== name) {
      const nameConflict = await prisma.learningTrack.findFirst({
        where: { name: { equals: name, mode: "insensitive" }, id: { not: params.id } },
      });
      if (nameConflict) {
        return NextResponse.json({ error: "Another learning track with this name already exists." }, { status: 400 });
      }
    }

    const updatedTrack = await prisma.$transaction(async (tx) => {
      const track = await tx.learningTrack.update({
        where: { id: params.id },
        data: { name, whatsappLink },
      });

      if (existingTrack.name !== name) {
        await tx.registration.updateMany({
          where: { techSkill: existingTrack.name },
          data: { techSkill: name },
        });
        await tx.communityManager.updateMany({
          where: { trackName: existingTrack.name },
          data: { trackName: name },
        });
        await tx.quiz.updateMany({
          where: { trackName: existingTrack.name },
          data: { trackName: name },
        });
        await tx.quizAttempt.updateMany({
          where: { trackName: existingTrack.name },
          data: { trackName: name },
        });
      }

      return track;
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

    const existingTrack = await prisma.learningTrack.findUnique({ where: { id: params.id } });
    if (!existingTrack) {
      return NextResponse.json({ error: "Learning track not found." }, { status: 404 });
    }

    const [regCount, quizCount, managerCount] = await Promise.all([
      prisma.registration.count({ where: { techSkill: existingTrack.name } }),
      prisma.quiz.count({ where: { trackName: existingTrack.name } }),
      prisma.communityManager.count({ where: { trackName: existingTrack.name } }),
    ]);

    if (regCount > 0 || quizCount > 0 || managerCount > 0) {
      return NextResponse.json(
        {
          error: `Cannot delete track "${existingTrack.name}". It still has ${regCount} participant(s), ${quizCount} quiz(zes), and ${managerCount} manager(s) assigned to it. Reassign or remove them first.`,
        },
        { status: 409 }
      );
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