import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin, readRole } from "@/lib/auth";
import { buildRegistrationListQuery, parseRegistrationInput } from "@/lib/registrations";

export const dynamic = "force-dynamic";

type ScopeResult =
  | { ok: true; role: "admin" | "manager"; scope: { techSkill: string } | null }
  | { ok: false; error: string; status: number };

async function resolveScope(req: Request): Promise<ScopeResult> {
  const userEmail = getRequestEmail(req);
  if (!userEmail) {
    return { ok: false, error: "Unauthorized: Missing email authentication header.", status: 401 };
  }

  const role = await readRole(userEmail);
  if (role.role === "none") {
    return { ok: false, error: "Forbidden: You do not have permission to access this page.", status: 403 };
  }

  if (role.role === "manager" && !role.trackName) {
    return {
      ok: false,
      error: "Forbidden: No learning track is assigned to your account yet. Ask the admin to assign one.",
      status: 403,
    };
  }

  const scope = role.role === "manager" ? { techSkill: role.trackName as string } : null;
  return { ok: true, role: isMainAdmin(userEmail) ? "admin" : "manager", scope };
}

export async function GET(req: Request) {
  try {
    const resolved = await resolveScope(req);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    const { where, orderBy, take, skip, sort, order, search, query } = buildRegistrationListQuery(
      new URL(req.url).searchParams,
      resolved.scope ?? undefined
    );

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({ where, orderBy, take, skip }),
      prisma.registration.count({ where }),
    ]);

    return NextResponse.json({
      data: registrations,
      total,
      limit: take,
      offset: skip,
      sort,
      order,
      field: search,
      query,
      scope: resolved.scope?.techSkill ?? null,
    });
  } catch (error) {
    console.error("Fetch Registrations Error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching registrations." },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    const resolved = await resolveScope(req);
    if (!resolved.ok) {
      return NextResponse.json({ error: resolved.error }, { status: resolved.status });
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = parseRegistrationInput(body, {
      lockedTechSkill: resolved.scope?.techSkill,
    });
    if (!parsed.ok) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }

    const input = parsed.value as {
      firstName: string;
      lastName: string;
      phone: string;
      techSkill: string;
      email: string;
    };

    const existing = await prisma.registration.findUnique({ where: { email: input.email } });
    if (existing) {
      return NextResponse.json({ error: "This email address is already registered." }, { status: 400 });
    }

    const created = await prisma.registration.create({ data: input });
    return NextResponse.json({ message: "Registration added successfully", data: created }, { status: 201 });
  } catch (error) {
    console.error("Create Registration Error:", error);
    return NextResponse.json({ error: "Internal server error while adding the user." }, { status: 500 });
  }
}