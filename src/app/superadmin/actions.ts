"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperadmin } from "@/lib/auth";

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
