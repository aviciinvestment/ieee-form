import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getAdminAccess } from "@/lib/auth";
import { whatsappLinkSchema } from "@/lib/validations";

export const dynamic = "force-dynamic";

const SUPPORT_KEY = "support_whatsapp_link";

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
    const access = await getAdminAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    let body: { whatsappLink?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const rawLink = typeof body.whatsappLink === "string" ? body.whatsappLink.trim() : "";
    if (!rawLink) {
      await prisma.appSetting.deleteMany({ where: { key: SUPPORT_KEY } });
      return NextResponse.json({ message: "Support link cleared", whatsappLink: null });
    }

    const parsed = whatsappLinkSchema.safeParse(rawLink);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "WhatsApp support link must start with https://chat.whatsapp.com/ or https://wa.me/" },
        { status: 400 }
      );
    }

    const link = parsed.data;

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