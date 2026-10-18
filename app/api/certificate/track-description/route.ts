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

    // 1. First check AppSetting cache for fast, reliable lookup
    const settingKey = `track_cert_desc_${trackName.toLowerCase().trim()}`;
    let customDescription = "";

    try {
      const setting = await prisma.appSetting.findUnique({
        where: { key: settingKey },
      });
      if (setting?.value?.trim()) {
        customDescription = setting.value.trim();
      }
    } catch {
      /* fallback */
    }

    // 2. If not found in AppSetting, check LearningTrack column via raw SQL or findFirst
    let matchedTrackName = trackName;
    if (!customDescription) {
      try {
        const rows = await prisma.$queryRawUnsafe<Array<{ name: string; certificateDescription?: string }>>(
          'SELECT name, "certificateDescription" FROM "LearningTrack" WHERE LOWER(name) = LOWER($1) LIMIT 1',
          trackName
        );
        if (rows.length > 0) {
          matchedTrackName = rows[0].name;
          if (rows[0].certificateDescription?.trim()) {
            customDescription = rows[0].certificateDescription.trim();
          }
        }
      } catch {
        /* fallback */
      }
    }

    // 3. Default template fallback
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

    // 1. Save in AppSetting for reliable, type-safe persistence across all environments
    const settingKey = `track_cert_desc_${targetTrackName.toLowerCase().trim()}`;
    await prisma.appSetting.upsert({
      where: { key: settingKey },
      update: { value: description },
      create: { key: settingKey, value: description },
    });

    // 2. Also persist to LearningTrack certificateDescription column via raw SQL
    try {
      await prisma.$executeRawUnsafe(
        'UPDATE "LearningTrack" SET "certificateDescription" = $1, "updatedAt" = NOW() WHERE id = $2',
        description,
        track.id
      );
    } catch (sqlErr) {
      console.warn("LearningTrack raw update warning (using AppSetting store):", sqlErr);
    }

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
