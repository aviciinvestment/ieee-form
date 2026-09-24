import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const userEmail = getRequestEmail(req);
    if (!userEmail) {
      return NextResponse.json(
        { error: "Unauthorized: Missing email authentication header." },
        { status: 401 }
      );
    }

    const emailLower = userEmail.toLowerCase();
    let isAuthorized = false;
    let isManager = null;

    if (isMainAdmin(userEmail)) {
      isAuthorized = true;
    } else {
      isManager = await prisma.communityManager.findUnique({ where: { email: emailLower } });
      if (isManager) isAuthorized = true;
    }

    if (!isAuthorized) {
      return NextResponse.json(
        { error: "Forbidden: You do not have permission to access this page." },
        { status: 403 }
      );
    }

    const where = isManager ? { techSkill: isManager.trackName } : {};

    const url = new URL(req.url);
    const rawLimit = Number(url.searchParams.get("limit")) || 200;
    const limit = Math.min(rawLimit, 1000);
    const offset = Math.max(Number(url.searchParams.get("offset")) || 0, 0);

    const [registrations, total] = await Promise.all([
      prisma.registration.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.registration.count({ where }),
    ]);

    return NextResponse.json({ data: registrations, total, limit, offset });
  } catch (error) {
    console.error("Fetch Registrations Error:", error);
    return NextResponse.json(
      { error: "Internal server error while fetching registrations." },
      { status: 500 }
    );
  }
}