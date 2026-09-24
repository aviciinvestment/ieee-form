import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getRequestEmail, isMainAdmin } from "@/lib/auth";

export const dynamic = "force-dynamic";

const SUPPORT_KEY = "support_whatsapp_link";

function isValidLink(value: string): boolean {
  return /^https?:\/\/.+/.test(value);
}

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({ where: { key: SUPPORT_KEY } });
    return NextResponse.json({ whatsappLink: setting?.value || null });
  } catch (error) {
    console.error("Get Support Link Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const userEmail = getRequestEmail(req);
    if (!isMainAdmin(userEmail)) {
      return NextResponse.json({ error: "Forbidden: Only the Admin can update the support link." }, { status: 403 });
    }

    let body: { whatsappLink?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const link = (body.whatsappLink ?? "").trim();
    if (!link) {
      await prisma.appSetting.deleteMany({ where: { key: SUPPORT_KEY } });
      return NextResponse.json({ message: "Support link cleared", whatsappLink: null });
    }
    if (!isValidLink(link)) {
      return NextResponse.json({ error: "Please enter a valid link (must start with http:// or https://)." }, { status: 400 });
    }

    await prisma.appSetting.upsert({
      where: { key: SUPPORT_KEY },
      update: { value: link },
      create: { key: SUPPORT_KEY, value: link },
    });

    return NextResponse.json({ message: "Support link updated successfully", whatsappLink: link });
  } catch (error) {
    console.error("Update Support Link Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}