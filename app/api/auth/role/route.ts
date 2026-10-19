import { NextResponse } from "next/server";
import { getVerifiedRequestEmail, readRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const email = await getVerifiedRequestEmail(req);
    if (!email) {
      return NextResponse.json({ error: "Missing or invalid authentication token." }, { status: 401 });
    }
    const role = await readRole(email);
    if (role.role === "manager" && role.trackName) {
      return NextResponse.json({ role: "manager", track: role.trackName });
    }
    return NextResponse.json({ role: role.role });
  } catch (error) {
    console.error("Role Check Error:", error);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}