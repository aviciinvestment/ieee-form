import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getParticipantAccess } from "@/lib/auth";
import { DEFAULT_CERTIFICATE_TEMPLATE, type CertificateTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const access = await getParticipantAccess(req);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const registration = await prisma.registration.findUnique({
      where: { id: access.registration.id },
    });

    if (!registration) {
      return NextResponse.json({ error: "Participant not found." }, { status: 404 });
    }

    if (!registration.approvedForCertificate) {
      return NextResponse.json({
        eligible: false,
        participant: {
          id: registration.id,
          firstName: registration.firstName,
          lastName: registration.lastName,
          email: registration.email,
          techSkill: registration.techSkill,
        },
        message:
          "Your certificate has not been approved yet. Once your track manager or the administrator approves your certificate, you will be able to view and download it here.",
      });
    }

    // Get active template
    let template = DEFAULT_CERTIFICATE_TEMPLATE;
    try {
      const setting = await prisma.appSetting.findUnique({
        where: { key: "certificate_template" },
      });
      if (setting) {
        template = { ...DEFAULT_CERTIFICATE_TEMPLATE, ...JSON.parse(setting.value) };
      }
    } catch {
      /* fallback */
    }

    // Template maintains official flier bodyText, while participant.techSkill is placed automatically into the project track section.

    return NextResponse.json({
      eligible: true,
      participant: {
        id: registration.id,
        firstName: registration.firstName,
        lastName: registration.lastName,
        email: registration.email,
        techSkill: registration.techSkill,
        approvedAt: registration.approvedAt,
      },
      template,
    });
  } catch (error) {
    console.error("Certificate Query Error:", error);
    return NextResponse.json(
      { error: "Internal server error while loading certificate." },
      { status: 500 }
    );
  }
}
