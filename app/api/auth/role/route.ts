import { NextResponse } from "next/server";
import { getRequestEmail, readRole } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  try {
    const email = getRequestEmail(req);
    if (!email) {
      return NextResponse.json({ error: "Missing email header" }, { status: 401 });
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