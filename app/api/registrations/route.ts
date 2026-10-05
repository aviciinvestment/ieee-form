import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getManagerAccess } from "@/lib/auth";
import { buildRegistrationListQuery, parseRegistrationInput } from "@/lib/registrations";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    // A manager is pinned to their own track; an admin sees everything unless a track is asked for.
    const scope = access.role === "manager" ? { techSkill: access.trackName } : undefined;

    const { where, orderBy, take, skip, sort, order, search, query } = buildRegistrationListQuery(
      new URL(req.url).searchParams,
      scope
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
      scope: scope?.techSkill ?? null,
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
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }
    const scope = access.role === "manager" ? { techSkill: access.trackName } : undefined;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = parseRegistrationInput(body, {
      lockedTechSkill: scope?.techSkill,
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