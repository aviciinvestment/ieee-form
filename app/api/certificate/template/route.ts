import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getManagerAccess } from "@/lib/auth";
import { DEFAULT_CERTIFICATE_TEMPLATE, type CertificateTemplate } from "@/lib/types";
import { certificateTemplateSchema } from "@/lib/validations";

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

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    const parsed = certificateTemplateSchema.safeParse(body);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message || "Validation failed.";
      return NextResponse.json({ error: message }, { status: 400 });
    }

    const validData = parsed.data;

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
      title: validData.title !== undefined ? validData.title : current.title,
      subtitle: validData.subtitle !== undefined ? validData.subtitle : current.subtitle,
      bodyText: validData.bodyText !== undefined ? validData.bodyText : current.bodyText,
      defaultTrack: validData.defaultTrack !== undefined ? validData.defaultTrack : current.defaultTrack,
      signatoryName: validData.signatoryName !== undefined ? validData.signatoryName : current.signatoryName,
      signatoryTitle: validData.signatoryTitle !== undefined ? validData.signatoryTitle : current.signatoryTitle,
      signatureUrl: validData.signatureUrl !== undefined ? validData.signatureUrl : current.signatureUrl,
      signatory2Name: validData.signatory2Name !== undefined ? validData.signatory2Name : current.signatory2Name,
      signatory2Title: validData.signatory2Title !== undefined ? validData.signatory2Title : current.signatory2Title,
      signatory2SignatureUrl: validData.signatory2SignatureUrl !== undefined ? validData.signatory2SignatureUrl : current.signatory2SignatureUrl,
      logoUrl: validData.logoUrl !== undefined ? validData.logoUrl : current.logoUrl,
      logoName: validData.logoName !== undefined ? validData.logoName : current.logoName,
      badgeText: validData.badgeText !== undefined ? validData.badgeText : current.badgeText,
      dateText: validData.dateText !== undefined ? validData.dateText : current.dateText,
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
