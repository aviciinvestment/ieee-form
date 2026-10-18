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

    // Check if the participant's track has a custom certificate description set by their manager
    if (registration.techSkill) {
      const trackKey = `track_cert_desc_${registration.techSkill.toLowerCase().trim()}`;
      let customDesc = "";

      try {
        const setting = await prisma.appSetting.findUnique({
          where: { key: trackKey },
        });
        if (setting?.value?.trim()) {
          customDesc = setting.value.trim();
        }
      } catch {
        /* fallback */
      }

      if (!customDesc) {
        try {
          const track = await prisma.learningTrack.findFirst({
            where: { name: { equals: registration.techSkill, mode: "insensitive" } },
          });
          if (track?.certificateDescription?.trim()) {
            customDesc = track.certificateDescription.trim();
          }
        } catch {
          /* fallback */
        }
      }

      if (customDesc) {
        template = {
          ...template,
          bodyText: customDesc,
        };
      }
    }

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
