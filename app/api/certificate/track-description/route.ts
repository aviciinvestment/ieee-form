import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { accessDeniedResponse, getManagerAccess } from "@/lib/auth";
import { DEFAULT_CERTIFICATE_TEMPLATE, type CertificateTemplate } from "@/lib/types";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const requestedTrack = searchParams.get("track")?.trim() || "";

    let trackName = requestedTrack;
    if (!trackName) {
      const access = await getManagerAccess(req);
      if (access.ok && access.role === "manager") {
        trackName = access.trackName;
      }
    }

    if (!trackName) {
      return NextResponse.json({ error: "Track name is required." }, { status: 400 });
    }

    // Check LearningTrack column
    let customDescription = "";
    let matchedTrackName = trackName;

    const track = await prisma.learningTrack.findFirst({
      where: { name: { equals: trackName, mode: "insensitive" } },
    });

    if (track) {
      matchedTrackName = track.name;
      if (track.certificateDescription?.trim()) {
        customDescription = track.certificateDescription.trim();
      }
    }

    // Default template fallback if track has no custom description
    let defaultBodyText = DEFAULT_CERTIFICATE_TEMPLATE.bodyText;
    try {
      const templateSetting = await prisma.appSetting.findUnique({
        where: { key: "certificate_template" },
      });
      if (templateSetting) {
        const parsed = JSON.parse(templateSetting.value) as CertificateTemplate;
        if (parsed.bodyText) defaultBodyText = parsed.bodyText;
      }
    } catch {
      /* fallback */
    }

    return NextResponse.json({
      trackName: matchedTrackName || trackName,
      description: customDescription || defaultBodyText,
      defaultDescription: defaultBodyText,
      isCustom: Boolean(customDescription),
    });
  } catch (error) {
    console.error("Get Track Certificate Description Error:", error);
    return NextResponse.json(
      { error: "Could not load certificate description for track." },
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

    let body: { trackName?: string; description?: string };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
    }

    // Determine target track
    let targetTrackName = "";
    if (access.role === "manager") {
      targetTrackName = access.trackName;
    } else if (access.role === "admin") {
      targetTrackName = body.trackName?.trim() || "";
    }

    if (!targetTrackName) {
      return NextResponse.json({ error: "Track name is required." }, { status: 400 });
    }

    const description = typeof body.description === "string" ? body.description.trim() : "";

    if (description.length > 280) {
      return NextResponse.json(
        { error: "Certificate description cannot exceed 280 characters to ensure it fits neatly on all devices." },
        { status: 400 }
      );
    }

    // Find the learning track
    const track = await prisma.learningTrack.findFirst({
      where: { name: { equals: targetTrackName, mode: "insensitive" } },
    });

    if (!track) {
      return NextResponse.json(
        { error: `Learning track "${targetTrackName}" not found.` },
        { status: 404 }
      );
    }

    // Persist cleanly to LearningTrack using Prisma
    await prisma.learningTrack.update({
      where: { id: track.id },
      data: { certificateDescription: description },
    });

    return NextResponse.json({
      message: `Certificate description for ${track.name} updated successfully.`,
      trackName: track.name,
      description,
      isCustom: Boolean(description),
    });
  } catch (error) {
    console.error("Update Track Certificate Description Error:", error);
    return NextResponse.json(
      { error: "Could not update track certificate description." },
      { status: 500 }
    );
  }
}
