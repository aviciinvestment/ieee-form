import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyFirebaseIdToken } from "@/lib/firebase-admin";

export type AuthRole = {
  role: "admin" | "manager" | "none";
  trackName?: string;
};

export function getAdminEmails(): string[] {
  const raw = process.env.ADMIN_EMAILS ?? "";
  return raw
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isMainAdmin(email: string | null | undefined): boolean {
  if (!email) return false;
  return getAdminEmails().includes(email.trim().toLowerCase());
}

export async function readRole(email: string | null | undefined): Promise<AuthRole> {
  if (isMainAdmin(email)) return { role: "admin" };
  if (email) {
    const manager = await prisma.communityManager.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    if (manager) return { role: "manager", trackName: manager.trackName };
  }
  return { role: "none" };
}

/** Extracts the Bearer token from the Authorization header. */
export function getBearerToken(req: Request): string | null {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Verifies the incoming Firebase ID token from the Authorization header
 * and returns the authenticated user's email.
 * Client-supplied X-User-Email is completely rejected to prevent spoofing.
 */
export async function getVerifiedRequestEmail(req: Request): Promise<string | null> {
  const token = getBearerToken(req);
  if (!token) return null;

  const decoded = await verifyFirebaseIdToken(token);
  if (!decoded || !decoded.email) return null;
  return decoded.email.trim().toLowerCase();
}

/**
 * @deprecated Use getVerifiedRequestEmail instead. Kept only for transition diagnostics.
 */
export function getRequestEmail(req: Request): string | null {
  console.warn("DEPRECATED: getRequestEmail called. Authentication now requires verified Bearer tokens.");
  return null;
}

export type ManagerAccess =
  | { ok: true; role: "admin"; email: string }
  | { ok: true; role: "manager"; trackName: string; email: string }
  | {
      ok: false;
      status: number;
      error: string;
      code: "NO_EMAIL" | "NO_ROLE" | "NO_TRACK";
    };

/** Admin-or-manager gate used by every portal management endpoint. */
export async function getManagerAccess(req: Request): Promise<ManagerAccess> {
  const email = await getVerifiedRequestEmail(req);
  if (!email) {
    return {
      ok: false,
      status: 401,
      code: "NO_EMAIL",
      error: "Unauthorized: Missing or invalid authentication token. Please sign in again.",
    };
  }

  const role = await readRole(email);
  if (role.role === "none") {
    return {
      ok: false,
      status: 403,
      code: "NO_ROLE",
      error: "Forbidden: You do not have permission to perform this action.",
    };
  }

  if (role.role === "admin") return { ok: true, role: "admin", email };

  if (!role.trackName) {
    return {
      ok: false,
      status: 403,
      code: "NO_TRACK",
      error:
        "No learning track is assigned to your account yet. Ask the admin to assign one on the admin dashboard.",
    };
  }

  return { ok: true, role: "manager", trackName: role.trackName, email };
}

export type AdminAccess =
  | { ok: true; email: string }
  | { ok: false; status: number; error: string; code?: string };

/** Strict admin-only gate for endpoints modifying managers, tracks, or templates. */
export async function getAdminAccess(req: Request): Promise<AdminAccess> {
  const access = await getManagerAccess(req);
  if (!access.ok) {
    return access;
  }
  if (access.role !== "admin") {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: Only an administrator can perform this action.",
    };
  }
  return { ok: true, email: access.email };
}

/** Turns a failed access check into the JSON body every portal endpoint returns. */
export function accessDeniedResponse(access: { status: number; error: string; code?: string }) {
  return NextResponse.json({ error: access.error, code: access.code }, { status: access.status });
}

export type ParticipantAccess =
  | {
      ok: true;
      registration: { id: string; firstName: string; lastName: string; email: string; techSkill: string };
    }
  | { ok: false; status: number; error: string };

/**
 * Participants are identified by the verified Gmail address in their Firebase ID token.
 * Their track always comes from the database so a client cannot claim another track.
 */
export async function getParticipantAccess(req: Request): Promise<ParticipantAccess> {
  const email = await getVerifiedRequestEmail(req);
  if (!email) {
    return { ok: false, status: 401, error: "Unauthorized: Please sign in with your verified Gmail address first." };
  }

  const registration = await prisma.registration.findUnique({ where: { email } });
  if (!registration) {
    return {
      ok: false,
      status: 403,
      error: "This Gmail address is not registered yet. Register on the home page first.",
    };
  }

  return {
    ok: true,
    registration: {
      id: registration.id,
      firstName: registration.firstName,
      lastName: registration.lastName,
      email: registration.email,
      techSkill: registration.techSkill,
    },
  };
}