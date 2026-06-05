"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { quickauth } from "@/lib/quickauth";

export type ChangePasswordState = { error?: string };

// Sets a new password after a reset. quickAuth (the IdP) owns the password; we
// change it there via the short-lived token stashed at login, then clear the
// must-change flag locally.
export async function completeChangePassword(
  _prev: ChangePasswordState,
  formData: FormData,
): Promise<ChangePasswordState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const token = cookies().get("cs_qa_token")?.value;
  if (!token) return { error: "Your session expired. Please sign in again." };

  const res = await fetch(`${quickauth.url}/oauth/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    cache: "no-store",
    body: JSON.stringify({ new_password: password }),
  });
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error_description?: string };
    return { error: body.error_description ?? "Could not update your password." };
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { mustChangePassword: false },
  });
  cookies().delete("cs_qa_token");
  redirect("/");
}
