import { prisma } from "@/lib/prisma";

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

export function getRequestEmail(req: Request): string | null {
  const header = req.headers.get("x-user-email");
  return header ? header.trim() : null;
}

export type ManagerAccess =
  | { ok: true; role: "admin"; email: string }
  | { ok: true; role: "manager"; trackName: string; email: string }
  | { ok: false; status: number; error: string };

/** Admin-or-manager gate used by every portal management endpoint. */
export async function getManagerAccess(req: Request): Promise<ManagerAccess> {
  const email = getRequestEmail(req);
  if (!email) {
    return { ok: false, status: 401, error: "Unauthorized: Missing email authentication header." };
  }

  const role = await readRole(email);
  if (role.role === "none") {
    return { ok: false, status: 403, error: "Forbidden: You do not have permission to perform this action." };
  }

  if (role.role === "admin") return { ok: true, role: "admin", email: email.trim().toLowerCase() };

  if (!role.trackName) {
    return {
      ok: false,
      status: 403,
      error: "Forbidden: No learning track is assigned to your account yet. Ask the admin to assign one.",
    };
  }

  return { ok: true, role: "manager", trackName: role.trackName, email: email.trim().toLowerCase() };
}

export type ParticipantAccess =
  | {
      ok: true;
      registration: { id: string; firstName: string; lastName: string; email: string; techSkill: string };
    }
  | { ok: false; status: number; error: string };

/**
 * Participants are identified by the Gmail address they registered with. Their
 * track always comes from the database so a client cannot claim another track.
 */
export async function getParticipantAccess(req: Request): Promise<ParticipantAccess> {
  const email = getRequestEmail(req);
  if (!email) {
    return { ok: false, status: 401, error: "Unauthorized: Please verify your Gmail address first." };
  }

  const registration = await prisma.registration.findUnique({ where: { email: email.toLowerCase() } });
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