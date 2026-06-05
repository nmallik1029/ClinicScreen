"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/auth";
import { quickauth } from "@/lib/quickauth";
import type { AddAdminState } from "./types";

export async function createPractice(formData: FormData) {
  await requireSuperadmin();
  const name = String(formData.get("name") ?? "").trim();
  const specialty = String(formData.get("specialty") ?? "").trim();
  if (!name) return;
  await prisma.practice.create({
    data: { name, specialty: specialty || null },
  });
  revalidatePath("/superadmin");
}

function tempPassword(): string {
  // Random, satisfies quickAuth strength (upper, lower, digit, 8+).
  const rnd = crypto.randomBytes(9).toString("base64").replace(/[^a-zA-Z0-9]/g, "");
  return `Aa1${rnd}${crypto.randomInt(10, 99)}`;
}

/** Provision a practice admin: create the quickAuth login + the ClinicScreen user. */
export async function addPracticeAdmin(
  practiceId: string,
  _prev: AddAdminState,
  formData: FormData
): Promise<AddAdminState> {
  await requireSuperadmin();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const username = String(formData.get("username") ?? "").trim();
  if (!name || !email || !username) return { error: "Name, email, and username are required." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "A user with that email already exists." };

  if (!quickauth.provisionSecret) return { error: "Provisioning is not configured (missing secret)." };

  const password = tempPassword();
  const res = await fetch(`${quickauth.url}/api/provision-user`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-provision-secret": quickauth.provisionSecret },
    cache: "no-store",
    body: JSON.stringify({ email, username, password, name }),
  });
  if (res.ok) {
    // Brand-new login created — show the temp password once.
    await prisma.user.create({ data: { name, email, role: "OFFICE_ADMIN", practiceId } });
    revalidatePath(`/superadmin/practices/${practiceId}`);
    return { tempPassword: password, username };
  }

  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (body.error === "email_taken") {
    // The quickAuth login already exists (e.g. a previously-removed admin).
    // Re-link it to this practice; they sign in with their existing password.
    await prisma.user.create({
      data: { name, email, role: "OFFICE_ADMIN", practiceId, onboardedAt: new Date() },
    });
    revalidatePath(`/superadmin/practices/${practiceId}`);
    return {
      message: `${email} already had a login — re-linked it to this practice. They sign in with their existing password (reset it in quickAuth if forgotten).`,
    };
  }
  const map: Record<string, string> = {
    username_taken: "That username is taken.",
    unauthorized: "Provisioning secret mismatch.",
  };
  return { error: map[body.error ?? ""] ?? "Could not create the login. Is quickAuth running?" };
}

export type ResetState = { error?: string; tempPassword?: string };

/** Reset an office admin's password to a temp value (they set their own on next login). */
export async function resetAdminPassword(
  practiceId: string,
  userId: string,
  _prev: ResetState,
  _formData: FormData
): Promise<ResetState> {
  await requireSuperadmin();
  const target = await prisma.user.findUnique({ where: { id: userId } });
  if (!target || target.practiceId !== practiceId || target.role === "SUPERADMIN") {
    return { error: "User not found." };
  }
  if (!quickauth.provisionSecret) return { error: "Provisioning is not configured (missing secret)." };

  const password = tempPassword();
  const res = await fetch(`${quickauth.url}/api/admin-reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-provision-secret": quickauth.provisionSecret },
    cache: "no-store",
    body: JSON.stringify({ email: target.email, password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    if (body.error === "not_found") return { error: "This user has no quickAuth login to reset." };
    return { error: "Could not reset the password. Is quickAuth reachable?" };
  }

  // Mirror the flag so they're sent to the reset screen on next login.
  await prisma.user.update({ where: { id: userId }, data: { mustChangePassword: true } });
  revalidatePath(`/superadmin/practices/${practiceId}`);
  return { tempPassword: password };
}

/** Permanently remove an office admin's ClinicScreen access (deletes the User row). */
export async function deleteAdmin(practiceId: string, userId: string) {
  await requireSuperadmin();
  const u = await prisma.user.findUnique({ where: { id: userId } });
  if (!u || u.practiceId !== practiceId || u.role === "SUPERADMIN") return;
  await prisma.user.delete({ where: { id: userId } });
  revalidatePath(`/superadmin/practices/${practiceId}`);
}

export async function setUserDisabled(practiceId: string, userId: string, disabled: boolean) {
  await requireSuperadmin();
  await prisma.user.update({
    where: { id: userId },
    data: disabled
      ? { disabledAt: new Date(), sessionsValidFrom: new Date() } // also revoke active sessions
      : { disabledAt: null },
  });
  revalidatePath(`/superadmin/practices/${practiceId}`);
}
