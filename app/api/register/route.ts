import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { RateLimit, getClientKey } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";

const registerLimiter = new RateLimit({ windowMs: 10 * 60 * 1000, max: 10 });

export async function POST(req: Request) {
  const limited = registerLimiter.check(getClientKey(req) + "|/api/register");
  if (!limited.ok) {
    return NextResponse.json(
      { error: "Too many registration attempts. Please wait and try again." },
      { status: 429, headers: { "Retry-After": String(limited.retryAfterSeconds) } }
    );
  }

  let body: { firstName?: string; lastName?: string; phone?: string; techSkill?: string; email?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const { firstName, lastName, phone, techSkill, email } = body;

    if (!firstName || !lastName || !phone || !techSkill || !email) {
      return NextResponse.json({ error: "All fields are required." }, { status: 400 });
    }

    if (!email.toLowerCase().endsWith("@gmail.com")) {
      return NextResponse.json({ error: "Only Gmail addresses are allowed." }, { status: 400 });
    }

    const existingUser = await prisma.registration.findUnique({
      where: { email: email.toLowerCase() },
    });
    if (existingUser) {
      return NextResponse.json({ error: "This Gmail address is already registered." }, { status: 400 });
    }

    const newRegistration = await prisma.registration.create({
      data: {
        firstName,
        lastName,
        phone,
        techSkill,
        email: email.toLowerCase(),
      },
    });

    const track = await prisma.learningTrack.findUnique({
      where: { name: techSkill },
    });

    return NextResponse.json(
      {
        message: "Registration successful!",
        data: newRegistration,
        whatsappLink: track ? track.whatsappLink : null,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration Error:", error);
    return NextResponse.json({ error: "Internal server error during registration." }, { status: 500 });
  }
}