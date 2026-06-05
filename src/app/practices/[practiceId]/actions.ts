"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePracticeAccess } from "@/lib/auth";
import {
  saveMediaFile,
  deleteUploadedFile,
  presignMediaUpload,
  mediaTypeForExt,
  mediaUrlBelongsToPractice,
  type MediaFormState,
  type PresignResult,
} from "@/lib/upload";
import { expireStalePending, enqueueRefresh, enqueueRefreshForPlaylist } from "@/lib/commands";
import { newDeviceToken } from "@/lib/device";
import { normalizeCode } from "@/lib/enroll";
import { rateLimit } from "@/lib/rate-limit";

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

export async function deleteLocation(practiceId: string, locationId: string) {
  await requirePracticeAccess(practiceId);
  const loc = await prisma.location.findUnique({
    where: { id: locationId },
    select: { practiceId: true },
  });
  if (!loc || loc.practiceId !== practiceId) return;
  // Unassign screens from this location, then delete it.
  await prisma.device.updateMany({ where: { locationId }, data: { locationId: null } });
  await prisma.location.delete({ where: { id: locationId } });
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
      token: newDeviceToken(),
    },
  });
  revalidatePath(`${base(practiceId)}/screens`);
}

export type ClaimState = { error?: string; ok?: boolean; deviceName?: string };

// Bind a pending player-device enrollment (identified by the pairing code shown on
// its TV) to a new Screen under this practice. The device then polls and receives
// the Screen's token.
export async function claimScreenByCode(
  practiceId: string,
  _prev: ClaimState,
  formData: FormData,
): Promise<ClaimState> {
  const user = await requirePracticeAccess(practiceId);
  // Throttle claim attempts so pairing codes can't be brute-forced.
  if (!rateLimit(`enroll:claim:${user.id}`, 10, 10 * 60 * 1000)) {
    return { error: "Too many attempts. Please wait a minute and try again." };
  }
  const code = normalizeCode(String(formData.get("code") ?? ""));
  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();

  if (!code) return { error: "Enter the pairing code shown on the screen." };
  if (!name) return { error: "Give the screen a name." };

  const enrollment = await prisma.pendingEnrollment.findUnique({ where: { code } });
  if (!enrollment || enrollment.status !== "PENDING" || enrollment.expiresAt < new Date()) {
    return { error: "That code is invalid or expired. Restart the screen to get a new code." };
  }

  const device = await prisma.device.create({
    data: {
      practiceId,
      name,
      roomType: roomType || null,
      locationId: locationId || null,
      token: newDeviceToken(),
    },
  });
  await prisma.pendingEnrollment.update({
    where: { id: enrollment.id },
    data: { status: "CLAIMED", deviceId: device.id, practiceId, claimedAt: new Date() },
  });

  revalidatePath(`${base(practiceId)}/screens`);
  return { ok: true, deviceName: device.name };
}

export async function deleteScreen(practiceId: string, deviceId: string) {
  await requirePracticeAccess(practiceId);
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { practiceId: true },
  });
  if (!device || device.practiceId !== practiceId) return;
  await prisma.deviceCommand.deleteMany({ where: { deviceId } });
  await prisma.device.delete({ where: { id: deviceId } });
  revalidatePath(`${base(practiceId)}/screens`);
}

export async function resetDeviceToken(practiceId: string, deviceId: string) {
  await requirePracticeAccess(practiceId);
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { practiceId: true },
  });
  if (!device || device.practiceId !== practiceId) return;
  await prisma.device.update({ where: { id: deviceId }, data: { token: newDeviceToken() } });
  revalidatePath(`${base(practiceId)}/screens`);
}

export async function updateScreen(practiceId: string, deviceId: string, formData: FormData) {
  await requirePracticeAccess(practiceId);
  // The screen must belong to this practice.
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { practiceId: true },
  });
  if (!device || device.practiceId !== practiceId) return;

  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "").trim();
  const locationId = String(formData.get("locationId") ?? "").trim();
  const assignedPlaylistId = String(formData.get("assignedPlaylistId") ?? "").trim();

  // Only accept a location/playlist that also belongs to this practice; otherwise
  // clear it (prevents linking another tenant's records via a crafted request).
  let validLocationId: string | null = null;
  if (locationId) {
    const loc = await prisma.location.findUnique({
      where: { id: locationId },
      select: { practiceId: true },
    });
    if (loc && loc.practiceId === practiceId) validLocationId = locationId;
  }
  let validPlaylistId: string | null = null;
  if (assignedPlaylistId) {
    const pl = await prisma.playlist.findUnique({
      where: { id: assignedPlaylistId },
      select: { practiceId: true },
    });
    if (pl && pl.practiceId === practiceId) validPlaylistId = assignedPlaylistId;
  }

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      name: name || undefined,
      roomType: roomType || null,
      locationId: validLocationId,
      assignedPlaylistId: validPlaylistId,
    },
  });
  // Reflect content/playlist changes on the live screen without a manual refresh.
  await enqueueRefresh(deviceId);
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

// Step 1 of a direct-to-R2 upload: hand the browser a presigned PUT URL.
export async function presignMediaAction(
  practiceId: string,
  filename: string,
  size: number,
): Promise<PresignResult> {
  await requirePracticeAccess(practiceId);
  return presignMediaUpload(practiceId, filename, size);
}

// Step 2: after the browser uploads straight to R2, record the Media row.
export async function finalizeMediaAction(
  practiceId: string,
  data: { title: string; url: string; durationSeconds?: number | null },
): Promise<MediaFormState> {
  await requirePracticeAccess(practiceId);
  const title = data.title?.trim();
  if (!title) return { error: "Please enter a title." };
  if (!data.url) return { error: "Upload didn’t complete. Please try again." };
  // The URL must be this practice's own uploaded object, not an arbitrary link.
  if (!mediaUrlBelongsToPractice(practiceId, data.url)) return { error: "Invalid upload." };
  const ext = data.url.split(".").pop()?.toLowerCase() ?? "";
  const type = mediaTypeForExt(ext);
  if (!type) return { error: "Unsupported file type." };

  await prisma.media.create({
    data: { practiceId, title, type, url: data.url, durationSeconds: data.durationSeconds ?? null },
  });
  revalidatePath(`${base(practiceId)}/media`);
  return { ok: true };
}

export async function deleteMedia(practiceId: string, mediaId: string) {
  await requirePracticeAccess(practiceId);
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.practiceId !== practiceId) return;
  await prisma.playlistItem.deleteMany({ where: { mediaId } });
  await prisma.media.delete({ where: { id: mediaId } });
  await deleteUploadedFile(media.url);
  revalidatePath(`${base(practiceId)}/media`);
}

export async function replaceMedia(
  practiceId: string,
  mediaId: string,
  _prevState: MediaFormState,
  formData: FormData
): Promise<MediaFormState> {
  await requirePracticeAccess(practiceId);
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  if (!media || media.practiceId !== practiceId) return { error: "Media not found." };

  const file = formData.get("file");
  if (!(file instanceof File)) return { error: "Please choose a file to upload." };
  const saved = await saveMediaFile(practiceId, file);
  if (!saved.ok) return { error: saved.error };

  const oldUrl = media.url;
  await prisma.media.update({
    where: { id: mediaId },
    data: { type: saved.type, url: saved.url },
  });
  await deleteUploadedFile(oldUrl);
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

export async function deletePlaylist(practiceId: string, playlistId: string) {
  await requirePracticeAccess(practiceId);
  const pl = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: { practiceId: true },
  });
  if (!pl || pl.practiceId !== practiceId) return;
  // Unassign from any screens, remove its items, then delete it.
  await prisma.device.updateMany({
    where: { assignedPlaylistId: playlistId },
    data: { assignedPlaylistId: null },
  });
  await prisma.playlistItem.deleteMany({ where: { playlistId } });
  await prisma.playlist.delete({ where: { id: playlistId } });
  revalidatePath(`${base(practiceId)}/playlists`);
}

export async function addPlaylistItem(practiceId: string, playlistId: string, formData: FormData) {
  await requirePracticeAccess(practiceId);
  const mediaId = String(formData.get("mediaId") ?? "").trim();
  if (!mediaId) return;
  // Both the playlist and the media must belong to this practice.
  const [pl, media] = await Promise.all([
    prisma.playlist.findUnique({ where: { id: playlistId }, select: { practiceId: true } }),
    prisma.media.findUnique({ where: { id: mediaId }, select: { practiceId: true } }),
  ]);
  if (!pl || pl.practiceId !== practiceId) return;
  if (!media || media.practiceId !== practiceId) return;

  const count = await prisma.playlistItem.count({ where: { playlistId } });
  await prisma.playlistItem.create({
    data: { playlistId, mediaId, position: count + 1 },
  });
  await enqueueRefreshForPlaylist(playlistId);
  revalidatePath(`${base(practiceId)}/playlists/${playlistId}`);
}

export async function removePlaylistItem(practiceId: string, playlistId: string, itemId: string) {
  await requirePracticeAccess(practiceId);
  // The playlist must belong to this practice.
  const pl = await prisma.playlist.findUnique({
    where: { id: playlistId },
    select: { practiceId: true },
  });
  if (!pl || pl.practiceId !== practiceId) return;
  // Delete only if the item actually belongs to this (practice-owned) playlist.
  await prisma.playlistItem.deleteMany({ where: { id: itemId, playlistId } });
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
  await enqueueRefreshForPlaylist(playlistId);
  revalidatePath(`${base(practiceId)}/playlists/${playlistId}`);
}

// --- Screen commands ---
export async function createRefreshCommand(practiceId: string, deviceId: string) {
  await requirePracticeAccess(practiceId);
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { practiceId: true },
  });
  if (!device || device.practiceId !== practiceId) return;
  await expireStalePending({ deviceId });
  // Don't stack duplicates: if a fresh refresh is already pending, leave it.
  const pending = await prisma.deviceCommand.findFirst({
    where: { deviceId, status: "PENDING" },
  });
  if (!pending) {
    await prisma.deviceCommand.create({
      data: { deviceId, commandType: "REFRESH", status: "PENDING" },
    });
  }
  revalidatePath(`${base(practiceId)}/screens`);
}
