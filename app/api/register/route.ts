import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { registrationSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const clientIp = getClientIp(req);
  const limited = await rateLimit(clientIp, { max: 5, windowSeconds: 600, prefix: "register" });
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds ?? 60) } }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = registrationSchema.safeParse(body);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message || "Validation failed.";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const { firstName, lastName, phone, techSkill, email } = parsed.data;

    const existingUser = await prisma.registration.findUnique({
      where: { email },
    });
    if (existingUser) {
      return NextResponse.json({ error: "This Gmail address is already registered." }, { status: 400 });
    }

    const track = await prisma.learningTrack.findFirst({
      where: { name: { equals: techSkill, mode: "insensitive" } },
    });
    if (!track) {
      return NextResponse.json({ error: "Selected learning track is invalid or does not exist." }, { status: 400 });
    }

    const newRegistration = await prisma.registration.create({
      data: {
        firstName,
        lastName,
        phone,
        techSkill: track.name,
        email,
      },
    });

    return NextResponse.json(
      {
        message: "Registration successful!",
        data: newRegistration,
        whatsappLink: track.whatsappLink || null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration Error:", error);
    return NextResponse.json({ error: "Internal server error during registration." }, { status: 500 });
  }
}