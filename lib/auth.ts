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