"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { quickauth } from "@/lib/quickauth";

export type OnboardingState = { error?: string };

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const preferredName = String(formData.get("preferredName") ?? "").trim();
  const password = String(formData.get("password") ?? "");
  const confirmPassword = String(formData.get("confirmPassword") ?? "");

  if (!preferredName) return { error: "Please enter a preferred name." };
  if (password !== confirmPassword) return { error: "Passwords do not match." };

  const token = cookies().get("cs_qa_token")?.value;
  if (!token) return { error: "Your session expired. Please sign in again." };

  // Change the password in quickAuth (the identity provider owns passwords).
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
    data: { preferredName, onboardedAt: new Date() },
  });
  cookies().delete("cs_qa_token");
  redirect("/");
}
