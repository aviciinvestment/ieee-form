import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin, readRole } from "@/lib/auth";
import { parseRegistrationInput } from "@/lib/registrations";

export const dynamic = "force-dynamic";

type AccessResult =
  | { ok: true; scope: { techSkill: string } | null }
  | { ok: false; error: string; status: number };

async function resolveAccess(req: Request): Promise<AccessResult> {
  const userEmail = getRequestEmail(req);
  if (!userEmail) {
    return { ok: false, error: "Unauthorized: Missing email authentication header.", status: 401 };
  }

  const role = await readRole(userEmail);
  if (role.role === "none") {
    return { ok: false, error: "Forbidden: You do not have permission to perform this action.", status: 403 };
  }

  if (role.role === "manager" && !role.trackName) {
    return {
      ok: false,
      error: "Forbidden: No learning track is assigned to your account yet. Ask the admin to assign one.",
      status: 403,
    };
  }

  return { ok: true, scope: role.role === "manager" ? { techSkill: role.trackName as string } : null };
}

async function findScopedRegistration(id: string, scope: { techSkill: string } | null) {
  return prisma.registration.findFirst({ where: { id, ...(scope ? { techSkill: scope.techSkill } : {}) } });
}

export async function PUT(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await resolveAccess(req);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const existing = await findScopedRegistration(params.id, access.scope);
    if (!existing) {
      return NextResponse.json({ error: "This user does not exist or is outside your track." }, { status: 404 });
    }

    const parsed = parseRegistrationInput(body, {
      partial: true,
      lockedTechSkill: access.scope?.techSkill,
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
    const access = await resolveAccess(req);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const existing = await findScopedRegistration(params.id, access.scope);
    if (!existing) {
      return NextResponse.json({ error: "This user does not exist or is outside your track." }, { status: 404 });
    }

    await prisma.registration.delete({ where: { id: existing.id } });
    return NextResponse.json({ message: "User deleted successfully", id: existing.id });
  } catch (error) {
    console.error("Delete Registration Error:", error);
    return NextResponse.json({ error: "Internal server error while deleting the user." }, { status: 500 });
  }
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  try {
    const access = await resolveAccess(req);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const existing = await findScopedRegistration(params.id, access.scope);
    if (!existing) {
      return NextResponse.json({ error: "This user does not exist or is outside your track." }, { status: 404 });
    }

    return NextResponse.json({ data: existing, isAdmin: isMainAdmin(getRequestEmail(req)) });
  } catch (error) {
    console.error("Fetch Registration Error:", error);
    return NextResponse.json({ error: "Internal server error while fetching the user." }, { status: 500 });
  }
}