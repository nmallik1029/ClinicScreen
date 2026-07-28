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
import {
  loadScreenItems,
  DEFAULT_DOCTOR_SECONDS,
  DEFAULT_IMAGE_SECONDS,
  type EditorItem,
  type LibraryMedia,
} from "@/lib/screen-content";

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

// --- Screen content (per-screen loop, edited from the content editor) ---
//
// Each screen owns a playlist that the user never sees as "a playlist" — it's
// just "this screen's content". These actions create/assign it on demand, mutate
// its items, push a live refresh to the device, and return the updated clip list
// so the editor can update without a round-trip refetch.

async function getScreenPlaylistId(practiceId: string, deviceId: string): Promise<string | null> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { practiceId: true, assignedPlaylistId: true },
  });
  if (!device || device.practiceId !== practiceId) return null;
  return device.assignedPlaylistId;
}

async function ensureScreenPlaylistId(practiceId: string, deviceId: string): Promise<string> {
  const device = await prisma.device.findUnique({
    where: { id: deviceId },
    select: { practiceId: true, assignedPlaylistId: true, name: true },
  });
  if (!device || device.practiceId !== practiceId) throw new Error("Screen not found");
  if (device.assignedPlaylistId) return device.assignedPlaylistId;
  const playlist = await prisma.playlist.create({
    data: { practiceId, name: `${device.name} content` },
  });
  await prisma.device.update({
    where: { id: deviceId },
    data: { assignedPlaylistId: playlist.id },
  });
  return playlist.id;
}

function revalidateScreen(practiceId: string, deviceId: string) {
  revalidatePath(`${base(practiceId)}/screens`);
  revalidatePath(`${base(practiceId)}/screens/${deviceId}`);
  revalidatePath(`${base(practiceId)}/screens/${deviceId}/edit`);
}

export async function addScreenContent(
  practiceId: string,
  deviceId: string,
  mediaId: string,
  insertIndex?: number,
): Promise<EditorItem[]> {
  await requirePracticeAccess(practiceId);
  const media = await prisma.media.findUnique({ where: { id: mediaId }, select: { practiceId: true } });
  if (!media || media.practiceId !== practiceId) {
    const existing = await getScreenPlaylistId(practiceId, deviceId);
    return existing ? loadScreenItems(existing) : [];
  }
  const playlistId = await ensureScreenPlaylistId(practiceId, deviceId);
  const count = await prisma.playlistItem.count({ where: { playlistId } });
  const targetPosition =
    typeof insertIndex === "number" && Number.isFinite(insertIndex)
      ? Math.max(1, Math.min(count + 1, Math.floor(insertIndex) + 1))
      : count + 1;
  await prisma.playlistItem.updateMany({
    where: { playlistId, position: { gte: targetPosition } },
    data: { position: { increment: 1 } },
  });
  await prisma.playlistItem.create({ data: { playlistId, mediaId, position: targetPosition } });
  await enqueueRefresh(deviceId);
  revalidateScreen(practiceId, deviceId);
  return loadScreenItems(playlistId);
}

const DOCTOR_INTERVAL_MINUTES = [1, 2, 5, 10];
const DOCTOR_DURATION_SECONDS = [5, 10, 15, 30];

/** Add a doctor card to the timeline (Manual mode), mirroring addScreenContent. */
export async function addDoctorContent(
  practiceId: string,
  deviceId: string,
  doctorId: string,
  insertIndex?: number,
): Promise<EditorItem[]> {
  await requirePracticeAccess(practiceId);
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, practiceId }, select: { id: true } });
  if (!doctor) {
    const existing = await getScreenPlaylistId(practiceId, deviceId);
    return existing ? loadScreenItems(existing) : [];
  }
  const playlistId = await ensureScreenPlaylistId(practiceId, deviceId);
  const count = await prisma.playlistItem.count({ where: { playlistId } });
  const targetPosition =
    typeof insertIndex === "number" && Number.isFinite(insertIndex)
      ? Math.max(1, Math.min(count + 1, Math.floor(insertIndex) + 1))
      : count + 1;
  await prisma.playlistItem.updateMany({
    where: { playlistId, position: { gte: targetPosition } },
    data: { position: { increment: 1 } },
  });
  await prisma.playlistItem.create({ data: { playlistId, kind: "DOCTOR", doctorId, position: targetPosition } });
  await enqueueRefresh(deviceId);
  revalidateScreen(practiceId, deviceId);
  return loadScreenItems(playlistId);
}

// The play length (leading gap + visible block) an existing item occupies — the
// same accounting loadScreenItems uses, so Auto spacing matches the timeline.
function itemSlotSeconds(it: {
  kind: string;
  leadingGapSeconds: number | null;
  durationOverrideSeconds: number | null;
  trimStartSeconds: number | null;
  trimEndSeconds: number | null;
  media: { durationSeconds: number | null; type: string } | null;
}): number {
  const gap = Math.max(0, it.leadingGapSeconds ?? 0);
  let block: number;
  if (it.kind === "DOCTOR") {
    block = it.durationOverrideSeconds ?? DEFAULT_DOCTOR_SECONDS;
  } else if (it.media?.type === "VIDEO") {
    const fallback = it.durationOverrideSeconds ?? DEFAULT_IMAGE_SECONDS;
    const source = it.media.durationSeconds ?? fallback;
    const start = Math.max(0, it.trimStartSeconds ?? 0);
    const end = Math.max(start + 1, it.trimEndSeconds ?? source);
    block = Math.max(1, end - start);
  } else {
    block = it.durationOverrideSeconds ?? DEFAULT_IMAGE_SECONDS;
  }
  return gap + block;
}

/**
 * Rebuild a screen's Auto-mode doctor clips: drop every auto clip, then weave the
 * featured doctors back through the timeline — one card at each interval boundary
 * of real content, cycling through the featured doctors in order. Manual clips and
 * media are never touched (only their positions renumber). Idempotent: calling it
 * again with the same inputs reproduces the same layout.
 */
async function rebuildAutoDoctorClips(
  playlistId: string,
  doctorIds: string[],
  intervalMinutes: number,
  durationSeconds: number,
): Promise<void> {
  await prisma.playlistItem.deleteMany({ where: { playlistId, autoGenerated: true } });
  const base = await prisma.playlistItem.findMany({
    where: { playlistId },
    orderBy: { position: "asc" },
    include: { media: { select: { durationSeconds: true, type: true } } },
  });

  if (doctorIds.length === 0) {
    // No featured doctors — just leave the base items compactly renumbered.
    await Promise.all(base.map((it, i) => prisma.playlistItem.update({ where: { id: it.id }, data: { position: i + 1 } })));
    return;
  }

  const intervalSec = Math.max(1, intervalMinutes) * 60;
  type Slot = { kind: "existing"; id: string } | { kind: "doctor"; doctorId: string };
  const order: Slot[] = [];
  let acc = 0;
  let nextBoundary = intervalSec;
  let rr = 0;
  for (const it of base) {
    order.push({ kind: "existing", id: it.id });
    acc += itemSlotSeconds(it);
    while (acc >= nextBoundary) {
      order.push({ kind: "doctor", doctorId: doctorIds[rr % doctorIds.length] });
      rr++;
      nextBoundary += intervalSec;
    }
  }
  // Content shorter than one interval: still show each featured doctor once.
  if (!order.some((o) => o.kind === "doctor")) {
    for (const doctorId of doctorIds) order.push({ kind: "doctor", doctorId });
  }

  let pos = 1;
  for (const slot of order) {
    if (slot.kind === "existing") {
      await prisma.playlistItem.update({ where: { id: slot.id }, data: { position: pos } });
    } else {
      await prisma.playlistItem.create({
        data: {
          playlistId,
          kind: "DOCTOR",
          doctorId: slot.doctorId,
          position: pos,
          autoGenerated: true,
          durationOverrideSeconds: durationSeconds,
        },
      });
    }
    pos++;
  }
}

/**
 * Persist a screen's doctor settings and reconcile the timeline. In Auto mode the
 * featured doctors are materialized as spaced clips; switching to Manual (or an
 * empty Auto set) clears the auto clips. Returns the updated timeline.
 */
export async function syncDoctorSchedule(
  practiceId: string,
  deviceId: string,
  settings: {
    mode: "MANUAL" | "AUTO";
    featuredDoctorIds: string[];
    intervalMinutes: number | null;
    durationSeconds: number | null;
  },
): Promise<EditorItem[]> {
  await requirePracticeAccess(practiceId);
  const device = await prisma.device.findFirst({ where: { id: deviceId, practiceId }, select: { id: true } });
  if (!device) {
    const existing = await getScreenPlaylistId(practiceId, deviceId);
    return existing ? loadScreenItems(existing) : [];
  }

  const valid = await prisma.doctor.findMany({
    where: { practiceId, id: { in: settings.featuredDoctorIds } },
    select: { id: true },
  });
  // Preserve the caller's ordering (round-robin uses it), keeping only real ids.
  const validSet = new Set(valid.map((d) => d.id));
  const doctorIds = settings.featuredDoctorIds.filter((id) => validSet.has(id));

  const interval =
    settings.intervalMinutes && DOCTOR_INTERVAL_MINUTES.includes(settings.intervalMinutes)
      ? settings.intervalMinutes
      : DOCTOR_INTERVAL_MINUTES[0];
  const duration =
    settings.durationSeconds && DOCTOR_DURATION_SECONDS.includes(settings.durationSeconds)
      ? settings.durationSeconds
      : DOCTOR_DURATION_SECONDS[1];

  await prisma.device.update({
    where: { id: deviceId },
    data: {
      doctorMode: settings.mode === "AUTO" ? "AUTO" : "MANUAL",
      doctorIntervalMinutes: settings.mode === "AUTO" ? interval : null,
      doctorDurationSeconds: settings.mode === "AUTO" ? duration : null,
      featuredDoctors: { set: doctorIds.map((id) => ({ id })) },
    },
  });

  const playlistId = await ensureScreenPlaylistId(practiceId, deviceId);
  await rebuildAutoDoctorClips(playlistId, settings.mode === "AUTO" ? doctorIds : [], interval, duration);

  await enqueueRefresh(deviceId);
  revalidateScreen(practiceId, deviceId);
  return loadScreenItems(playlistId);
}

export async function removeScreenContent(
  practiceId: string,
  deviceId: string,
  itemId: string,
): Promise<EditorItem[]> {
  await requirePracticeAccess(practiceId);
  const playlistId = await getScreenPlaylistId(practiceId, deviceId);
  if (!playlistId) return [];
  await prisma.playlistItem.deleteMany({ where: { id: itemId, playlistId } });
  // Renumber remaining items by current order.
  const items = await prisma.playlistItem.findMany({ where: { playlistId }, orderBy: { position: "asc" } });
  await Promise.all(
    items.map((it, i) => prisma.playlistItem.update({ where: { id: it.id }, data: { position: i + 1 } })),
  );
  await enqueueRefresh(deviceId);
  revalidateScreen(practiceId, deviceId);
  return loadScreenItems(playlistId);
}

export async function reorderScreenContent(
  practiceId: string,
  deviceId: string,
  orderedItemIds: string[],
): Promise<EditorItem[]> {
  await requirePracticeAccess(practiceId);
  const playlistId = await getScreenPlaylistId(practiceId, deviceId);
  if (!playlistId) return [];
  // Only renumber items that actually belong to this screen's loop.
  const owned = new Set(
    (await prisma.playlistItem.findMany({ where: { playlistId }, select: { id: true } })).map((i) => i.id),
  );
  let position = 1;
  await Promise.all(
    orderedItemIds
      .filter((id) => owned.has(id))
      .map((id) => prisma.playlistItem.update({ where: { id }, data: { position: position++ } })),
  );
  await enqueueRefresh(deviceId);
  revalidateScreen(practiceId, deviceId);
  return loadScreenItems(playlistId);
}

/**
 * Persist the timeline's full layout in one shot: the array order becomes each
 * clip's position, and `leadingGapSeconds` is the black gap before it. Used when
 * a clip is dragged to a new spot (which can change both order and spacing).
 */
export async function saveScreenLayout(
  practiceId: string,
  deviceId: string,
  layout: { id: string; leadingGapSeconds: number }[],
): Promise<EditorItem[]> {
  await requirePracticeAccess(practiceId);
  const playlistId = await getScreenPlaylistId(practiceId, deviceId);
  if (!playlistId) return [];
  const owned = new Set(
    (await prisma.playlistItem.findMany({ where: { playlistId }, select: { id: true } })).map((i) => i.id),
  );
  let position = 1;
  await Promise.all(
    layout
      .filter((entry) => owned.has(entry.id))
      .map((entry) =>
        prisma.playlistItem.update({
          where: { id: entry.id },
          data: {
            position: position++,
            leadingGapSeconds: Math.max(0, Math.round(entry.leadingGapSeconds || 0)),
          },
        }),
      ),
  );
  await enqueueRefresh(deviceId);
  revalidateScreen(practiceId, deviceId);
  return loadScreenItems(playlistId);
}

export async function setScreenContentDuration(
  practiceId: string,
  deviceId: string,
  itemId: string,
  seconds: number | null,
): Promise<EditorItem[]> {
  await requirePracticeAccess(practiceId);
  const playlistId = await getScreenPlaylistId(practiceId, deviceId);
  if (!playlistId) return [];
  const clean = seconds && seconds > 0 ? Math.min(Math.round(seconds), 3600) : null;
  await prisma.playlistItem.updateMany({
    where: { id: itemId, playlistId },
    data: { durationOverrideSeconds: clean },
  });
  await enqueueRefresh(deviceId);
  revalidateScreen(practiceId, deviceId);
  return loadScreenItems(playlistId);
}

export async function setScreenContentTrim(
  practiceId: string,
  deviceId: string,
  itemId: string,
  trimStartSeconds: number,
  trimEndSeconds: number | null,
  leadingGapSeconds?: number,
): Promise<EditorItem[]> {
  await requirePracticeAccess(practiceId);
  const playlistId = await getScreenPlaylistId(practiceId, deviceId);
  if (!playlistId) return [];
  const item = await prisma.playlistItem.findFirst({
    where: { id: itemId, playlistId },
    include: { media: true },
  });
  if (!item) return [];

  if (!item.media || item.media.type !== "VIDEO") return loadScreenItems(playlistId);

  const sourceDuration = item.media.durationSeconds ?? item.durationOverrideSeconds ?? 10;
  const start = Math.max(0, Math.min(Math.round(trimStartSeconds), sourceDuration - 1));
  const requestedEnd = trimEndSeconds == null ? sourceDuration : Math.round(trimEndSeconds);
  const end = Math.max(start + 1, Math.min(requestedEnd, sourceDuration));
  await prisma.playlistItem.update({
    where: { id: item.id },
    data: {
      trimStartSeconds: start <= 0 ? null : start,
      trimEndSeconds: end >= sourceDuration ? null : end,
      // Trimming the front opens an "island" gap; persist it when provided.
      ...(leadingGapSeconds != null
        ? { leadingGapSeconds: Math.max(0, Math.round(leadingGapSeconds)) }
        : {}),
    },
  });
  await enqueueRefresh(deviceId);
  revalidateScreen(practiceId, deviceId);
  return loadScreenItems(playlistId);
}

export async function deleteLibraryMediaForEditor(
  practiceId: string,
  deviceId: string,
  mediaId: string,
): Promise<{ items: EditorItem[]; library: LibraryMedia[] }> {
  await requirePracticeAccess(practiceId);
  const media = await prisma.media.findUnique({ where: { id: mediaId } });
  const playlistId = await getScreenPlaylistId(practiceId, deviceId);
  if (!media || media.practiceId !== practiceId) {
    return {
      items: playlistId ? await loadScreenItems(playlistId) : [],
      library: await loadEditorLibrary(practiceId),
    };
  }

  const affectedPlaylistIds = Array.from(
    new Set(
      (await prisma.playlistItem.findMany({ where: { mediaId }, select: { playlistId: true } })).map(
        (item) => item.playlistId,
      ),
    ),
  );
  await prisma.playlistItem.deleteMany({ where: { mediaId } });
  await Promise.all(
    affectedPlaylistIds.map(async (affectedPlaylistId) => {
      const items = await prisma.playlistItem.findMany({
        where: { playlistId: affectedPlaylistId },
        orderBy: { position: "asc" },
      });
      await Promise.all(
        items.map((it, i) => prisma.playlistItem.update({ where: { id: it.id }, data: { position: i + 1 } })),
      );
      await enqueueRefreshForPlaylist(affectedPlaylistId);
    }),
  );
  if (playlistId && !affectedPlaylistIds.includes(playlistId)) {
    const items = await prisma.playlistItem.findMany({ where: { playlistId }, orderBy: { position: "asc" } });
    await Promise.all(
      items.map((it, i) => prisma.playlistItem.update({ where: { id: it.id }, data: { position: i + 1 } })),
    );
  }
  await prisma.media.delete({ where: { id: media.id } });
  await deleteUploadedFile(media.url);
  await enqueueRefresh(deviceId);
  revalidatePath(`${base(practiceId)}/media`);
  revalidateScreen(practiceId, deviceId);
  return {
    items: playlistId ? await loadScreenItems(playlistId) : [],
    library: await loadEditorLibrary(practiceId),
  };
}

// --- Screen info + location (edited inline on the screen detail page) ---

// Update only name + room type; leaves location/content untouched.
export async function updateScreenInfo(practiceId: string, deviceId: string, formData: FormData) {
  await requirePracticeAccess(practiceId);
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { practiceId: true } });
  if (!device || device.practiceId !== practiceId) return;
  const name = String(formData.get("name") ?? "").trim();
  const roomType = String(formData.get("roomType") ?? "").trim();
  await prisma.device.update({
    where: { id: deviceId },
    data: { name: name || undefined, roomType: roomType || null },
  });
  revalidateScreen(practiceId, deviceId);
}

export async function setScreenLocation(practiceId: string, deviceId: string, locationId: string) {
  await requirePracticeAccess(practiceId);
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { practiceId: true } });
  if (!device || device.practiceId !== practiceId) return;
  let valid: string | null = null;
  if (locationId) {
    const loc = await prisma.location.findUnique({ where: { id: locationId }, select: { practiceId: true } });
    if (loc && loc.practiceId === practiceId) valid = locationId;
  }
  await prisma.device.update({ where: { id: deviceId }, data: { locationId: valid } });
  revalidateScreen(practiceId, deviceId);
}

// Create a location and immediately assign it to this screen. Returns the
// refreshed location list + the new selection so the inline field can update.
export async function createLocationForScreen(
  practiceId: string,
  deviceId: string,
  name: string,
): Promise<{ locations: { id: string; name: string }[]; selectedId: string }> {
  await requirePracticeAccess(practiceId);
  const device = await prisma.device.findUnique({ where: { id: deviceId }, select: { practiceId: true } });
  const clean = name.trim();
  if (!device || device.practiceId !== practiceId || !clean) {
    const locations = await prisma.location.findMany({
      where: { practiceId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    });
    return { locations, selectedId: "" };
  }
  const created = await prisma.location.create({ data: { practiceId, name: clean } });
  await prisma.device.update({ where: { id: deviceId }, data: { locationId: created.id } });
  const locations = await prisma.location.findMany({
    where: { practiceId },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
  revalidateScreen(practiceId, deviceId);
  return { locations, selectedId: created.id };
}

// --- Media upload from the editor (returns the created library entry) ---

type EditorUploadResult = { ok: true; media: LibraryMedia } | { ok?: false; error: string };

function toLibraryMedia(m: {
  id: string;
  title: string;
  type: string;
  url: string;
  durationSeconds: number | null;
}): LibraryMedia {
  return {
    id: m.id,
    title: m.title,
    type: m.type as "VIDEO" | "IMAGE",
    url: m.url,
    durationSeconds: m.durationSeconds,
  };
}

async function loadEditorLibrary(practiceId: string): Promise<LibraryMedia[]> {
  const media = await prisma.media.findMany({
    where: { practiceId },
    orderBy: { createdAt: "desc" },
    select: { id: true, title: true, type: true, url: true, durationSeconds: true },
  });
  return media.map(toLibraryMedia);
}

// Dev / no-R2 path: file comes through the server action as FormData.
export async function uploadMediaLocalForEditor(
  practiceId: string,
  formData: FormData,
): Promise<EditorUploadResult> {
  await requirePracticeAccess(practiceId);
  const title = String(formData.get("title") ?? "").trim();
  const durationRaw = String(formData.get("durationSeconds") ?? "").trim();
  const file = formData.get("file");
  if (!title) return { error: "Please enter a title." };
  if (!(file instanceof File)) return { error: "Please choose a file." };
  const saved = await saveMediaFile(practiceId, file);
  if (!saved.ok) return { error: saved.error };
  const durationSeconds = durationRaw ? Math.max(1, Math.round(Number(durationRaw))) : null;
  const media = await prisma.media.create({
    data: { practiceId, title, type: saved.type, url: saved.url, durationSeconds },
  });
  revalidatePath(`${base(practiceId)}/screens`);
  return { ok: true, media: toLibraryMedia(media) };
}

// R2 path: browser already PUT the object; record the row and return it.
export async function finalizeMediaForEditor(
  practiceId: string,
  data: { title: string; url: string; durationSeconds?: number | null },
): Promise<EditorUploadResult> {
  await requirePracticeAccess(practiceId);
  const title = data.title?.trim();
  if (!title) return { error: "Please enter a title." };
  if (!data.url || !mediaUrlBelongsToPractice(practiceId, data.url)) return { error: "Invalid upload." };
  const ext = data.url.split(".").pop()?.toLowerCase() ?? "";
  const type = mediaTypeForExt(ext);
  if (!type) return { error: "Unsupported file type." };
  const durationSeconds = data.durationSeconds ? Math.max(1, Math.round(data.durationSeconds)) : null;
  const media = await prisma.media.create({
    data: { practiceId, title, type, url: data.url, durationSeconds },
  });
  revalidatePath(`${base(practiceId)}/screens`);
  return { ok: true, media: toLibraryMedia(media) };
}
