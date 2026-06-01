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
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    const map: Record<string, string> = {
      email_taken: "That email already has a login.",
      username_taken: "That username is taken.",
      unauthorized: "Provisioning secret mismatch.",
    };
    return { error: map[body.error ?? ""] ?? "Could not create the login. Is quickAuth running?" };
  }

  await prisma.user.create({
    data: { name, email, role: "OFFICE_ADMIN", practiceId },
  });

  revalidatePath(`/superadmin/practices/${practiceId}`);
  return { tempPassword: password, username };
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
