import { NextResponse } from "next/server";
import type { Registration } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  accessDeniedResponse,
  getManagerAccess,
  getRequestEmail,
  isMainAdmin,
  type ManagerAccess,
} from "@/lib/auth";
import { parseRegistrationInput } from "@/lib/registrations";

export const dynamic = "force-dynamic";

type ScopedRead =
  | { ok: true; registration: Registration; isAdmin: boolean }
  | { ok: false; status: number; error: string; code?: string };

/**
 * Reads one registration, refusing anything outside the caller's track. Managers can only ever see
 * their own track, so the scope check happens on the read rather than on the write.
 */
async function findScopedRegistration(
  id: string,
  access: Extract<ManagerAccess, { ok: true }>
): Promise<ScopedRead> {
  const existing = await prisma.registration.findFirst({
    where: { id, ...(access.role === "manager" ? { techSkill: access.trackName } : {}) },
  });
  if (!existing) {
    return { ok: false, status: 404, error: "This user does not exist or is outside your track." };
  }
  return { ok: true, registration: existing, isAdmin: access.role === "admin" };
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const found = await findScopedRegistration(params.id, access);
    if (!found.ok) {
      return accessDeniedResponse(found);
    }
    const existing = found.registration;

    const parsed = parseRegistrationInput(body, {
      partial: true,
      lockedTechSkill: access.role === "manager" ? access.trackName : undefined,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    if (Object.keys(parsed.value).length === 0) {
      return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
    }

    const nextEmail = parsed.value.email;
    if (nextEmail && nextEmail !== existing.email) {
      const duplicate = await prisma.registration.findUnique({ where: { email: nextEmail } });
      if (duplicate) {
        return NextResponse.json({ error: "Another user is already using this email address." }, { status: 400 });
      }
    }

    const updated = await prisma.registration.update({ where: { id: existing.id }, data: parsed.value });
    return NextResponse.json({ message: "User updated successfully", data: updated });
  } catch (error) {
    console.error("Update Registration Error:", error);
    return NextResponse.json({ error: "Internal server error while updating the user." }, { status: 500 });
  }
}

export async function DELETE(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    const found = await findScopedRegistration(params.id, access);
    if (!found.ok) {
      return accessDeniedResponse(found);
    }

    await prisma.registration.delete({ where: { id: found.registration.id } });
    return NextResponse.json({ message: "User deleted successfully", id: found.registration.id });
  } catch (error) {
    console.error("Delete Registration Error:", error);
    return NextResponse.json({ error: "Internal server error while deleting the user." }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    const found = await findScopedRegistration(params.id, access);
    if (!found.ok) {
      return accessDeniedResponse(found);
    }

    return NextResponse.json({
      data: found.registration,
      isAdmin: found.isAdmin || isMainAdmin(getRequestEmail(req)),
    });
  } catch (error) {
    console.error("Fetch Registration Error:", error);
    return NextResponse.json({ error: "Internal server error while fetching the user." }, { status: 500 });
  }
}
