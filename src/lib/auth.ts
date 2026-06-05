import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSession } from "@/lib/session";

/**
 * Returns the ClinicScreen User for the current session, or null if anonymous.
 * The session is established after a quickAuth OAuth login (linked by email),
 * see src/app/auth/callback/route.ts.
 */
export async function getCurrentUser(): Promise<User | null> {
  const session = getSession();
  if (!session) return null;
  const user = await prisma.user.findUnique({ where: { id: session.userId } });
  if (!user) return null;
  if (user.disabledAt) return null; // offboarded
  // Revoked sessions: issued before the user's "valid from" cutoff.
  if (user.sessionsValidFrom && session.issuedAt < user.sessionsValidFrom.getTime()) return null;
  return user;
}

async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Office admins must complete first-login onboarding before using the app.
  if (user.role === "OFFICE_ADMIN" && !user.onboardedAt) redirect("/onboarding");
  // Anyone whose password was reset must set a new one before continuing.
  if (user.mustChangePassword) redirect("/change-password");
  return user;
}

export async function requireSuperadmin(): Promise<User> {
  const user = await requireUser();
  if (user.role !== "SUPERADMIN") redirect("/unauthorized");
  return user;
}

export async function requireOfficeAdmin(): Promise<User> {
  // Any signed-in, provisioned user (superadmins may also act as office admins).
  return requireUser();
}

/** Superadmins may access any practice; office admins only their own. */
export async function requirePracticeAccess(practiceId: string): Promise<User> {
  const user = await requireUser();
  if (user.role === "SUPERADMIN") return user;
  if (user.practiceId !== practiceId) redirect("/unauthorized");
  return user;
}
