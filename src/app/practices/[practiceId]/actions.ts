"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePracticeAccess } from "@/lib/auth";
import { saveMediaFile, type MediaFormState } from "@/lib/upload";

const base = (practiceId: string) => `/practices/${practiceId}`;

// --- Locations ---
export async function createLocation(practiceId: string, formData: FormData) {
  await requirePracticeAccess(practiceId);
  const name = String(formData.get("name") ?? "").trim();
  const address = String(formData.get("address") ?? "").trim();
  if (!name) return;
  await prisma.location.create({ data: { practiceId, name, address: address || null } });
  revalidatePath(`${base(practiceId)}/locations`);
}

// --- Screens (Devices) ---
export async function createScreen(practiceId: string, formData: FormData) {
  await requirePracticeAccess(practiceId);
  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  if (!name) return;
  await prisma.device.create({
    data: {
      practiceId,
      name,
      roomType: roomType || null,
      locationId: locationId || null,
    },
  });
  revalidatePath(`${base(practiceId)}/screens`);
}

export async function updateScreen(practiceId: string, deviceId: string, formData: FormData) {
  await requirePracticeAccess(practiceId);
  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const assignedPlaylistId = String(formData.get("assignedPlaylistId") ?? "").trim();
  await prisma.device.update({
    where: { id: deviceId },
    data: {
      name: name || undefined,
      roomType: roomType || null,
      locationId: locationId || null,
      assignedPlaylistId: assignedPlaylistId || null,
    },
  });
  revalidatePath(`${base(practiceId)}/screens`);
}

// --- Media ---
export async function createMedia(
  practiceId: string,
  _prevState: MediaFormState,
  formData: FormData
): Promise<MediaFormState> {
  await requirePracticeAccess(practiceId);
  const title = String(formData.get("title") ?? "").trim();
  const durationRaw = String(formData.get("durationSeconds") ?? "").trim();
  const file = formData.get("file");
  if (!title) return { error: "Please enter a title." };
  if (!(file instanceof File)) return { error: "Please choose a file to upload." };

  const saved = await saveMediaFile(practiceId, file);
  if (!saved.ok) return { error: saved.error };

  await prisma.media.create({
    data: {
      practiceId,
      title,
      type: saved.type,
      url: saved.url,
      durationSeconds: durationRaw ? Number(durationRaw) : null,
    },
  });
  revalidatePath(`${base(practiceId)}/media`);
  return { ok: true };
}

// --- Playlists ---
export async function createPlaylist(practiceId: string, formData: FormData) {
  await requirePracticeAccess(practiceId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  await prisma.playlist.create({ data: { practiceId, name } });
  revalidatePath(`${base(practiceId)}/playlists`);
}

export async function addPlaylistItem(practiceId: string, playlistId: string, formData: FormData) {
  await requirePracticeAccess(practiceId);
  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!mediaId) return;
  const count = await prisma.playlistItem.count({ where: { playlistId } });
  await prisma.playlistItem.create({
    data: { playlistId, mediaId, position: count + 1 },
  });
  revalidatePath(`${base(practiceId)}/playlists/${playlistId}`);
}

export async function removePlaylistItem(practiceId: string, playlistId: string, itemId: string) {
  await requirePracticeAccess(practiceId);
  await prisma.playlistItem.delete({ where: { id: itemId } });
  // Renumber remaining items by current order.
  const items = await prisma.playlistItem.findMany({
    where: { playlistId },
    orderBy: { position: "asc" },
  });
  await Promise.all(
    items.map((it, i) =>
      prisma.playlistItem.update({ where: { id: it.id }, data: { position: i + 1 } })
    )
  );
  revalidatePath(`${base(practiceId)}/playlists/${playlistId}`);
}
