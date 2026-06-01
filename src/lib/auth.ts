import { redirect } from "next/navigation";
import type { User } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getSessionUserId } from "@/lib/session";

/**
 * Returns the ClinicScreen User for the current session, or null if anonymous.
 * The session is established after a quickAuth OAuth login (linked by email),
 * see src/app/auth/callback/route.ts.
 */
export async function getCurrentUser(): Promise<User | null> {
  const userId = getSessionUserId();
  if (!userId) return null;
  return prisma.user.findUnique({ where: { id: userId } });
}

async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
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
