import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getManagerAccess } from "@/lib/auth";
import { DEFAULT_CERTIFICATE_TEMPLATE, type CertificateTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

const SETTING_KEY = "certificate_template";

export async function GET() {
  try {
    const setting = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });

    if (!setting) {
      return NextResponse.json({ data: DEFAULT_CERTIFICATE_TEMPLATE });
    }

    try {
      const parsed = JSON.parse(setting.value) as CertificateTemplate;
      return NextResponse.json({
        data: {
          ...DEFAULT_CERTIFICATE_TEMPLATE,
          ...parsed,
        },
      });
    } catch {
      return NextResponse.json({ data: DEFAULT_CERTIFICATE_TEMPLATE });
    }
  } catch (error) {
    console.error("Fetch Certificate Template Error:", error);
    return NextResponse.json(
      { error: "Could not load certificate template." },
      { status: 500 }
    );
  }
}

export async function PUT(req: Request) {
  try {
    const access = await getManagerAccess(req);
    if (!access.ok) {
      return accessDeniedResponse(access);
    }

    if (access.role !== "admin") {
      return NextResponse.json(
        { error: "Forbidden: Only admins can edit the certificate template." },
        { status: 403 }
      );
    }

    let body: Partial<CertificateTemplate>;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const currentSetting = await prisma.appSetting.findUnique({
      where: { key: SETTING_KEY },
    });
    let current = DEFAULT_CERTIFICATE_TEMPLATE;
    if (currentSetting) {
      try {
        current = { ...DEFAULT_CERTIFICATE_TEMPLATE, ...JSON.parse(currentSetting.value) };
      } catch {
        /* fallback */
      }
    }

    const updatedTemplate: CertificateTemplate = {
      logoUrl: typeof body.logoUrl === "string" ? body.logoUrl.trim() : current.logoUrl,
      logoName: typeof body.logoName === "string" && body.logoName.trim() ? body.logoName.trim() : current.logoName,
      badgeText: typeof body.badgeText === "string" && body.badgeText.trim() ? body.badgeText.trim() : current.badgeText,
      title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : current.title,
      subtitle: typeof body.subtitle === "string" && body.subtitle.trim() ? body.subtitle.trim() : current.subtitle,
      bodyText: typeof body.bodyText === "string" && body.bodyText.trim() ? body.bodyText.trim() : current.bodyText,
      dateText: typeof body.dateText === "string" && body.dateText.trim() ? body.dateText.trim() : current.dateText,
      signatoryName: typeof body.signatoryName === "string" && body.signatoryName.trim() ? body.signatoryName.trim() : current.signatoryName,
      signatoryTitle: typeof body.signatoryTitle === "string" && body.signatoryTitle.trim() ? body.signatoryTitle.trim() : current.signatoryTitle,
      signatureUrl: typeof body.signatureUrl === "string" ? body.signatureUrl.trim() : current.signatureUrl,
    };

    await prisma.appSetting.upsert({
      where: { key: SETTING_KEY },
      create: {
        key: SETTING_KEY,
        value: JSON.stringify(updatedTemplate),
      },
      update: {
        value: JSON.stringify(updatedTemplate),
      },
    });

    return NextResponse.json({
      message: "Certificate template updated successfully.",
      data: updatedTemplate,
    });
  } catch (error) {
    console.error("Update Certificate Template Error:", error);
    return NextResponse.json(
      { error: "Could not update certificate template." },
      { status: 500 }
    );
  }
}
