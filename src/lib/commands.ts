import { prisma } from "@/lib/prisma";

// A refresh that isn't picked up by an online player within this window is
// considered stale (the screen was offline/closed) and is marked FAILED.
export const STALE_PENDING_MS = 2 * 60 * 1000; // 2 minutes

// How far back the dashboard lists a screen's recent commands.
export const RECENT_COMMAND_MS = 30 * 60 * 1000; // 30 minutes

export async function expireStalePending(where: { deviceId?: string; practiceId?: string }) {
  await prisma.deviceCommand.updateMany({
    where: {
      status: "PENDING",
      createdAt: { lt: new Date(Date.now() - STALE_PENDING_MS) },
      ...(where.deviceId ? { deviceId: where.deviceId } : {}),
      ...(where.practiceId ? { device: { practiceId: where.practiceId } } : {}),
    },
    data: { status: "FAILED", completedAt: new Date() },
  });
}

/**
 * Queue a REFRESH for a device unless one is already pending (dedupe). The player
 * agent polls for this and re-fetches its assigned playlist — so content changes
 * reach the screen on their own within the agent's poll interval (~12s).
 */
export async function enqueueRefresh(deviceId: string) {
  await expireStalePending({ deviceId });
  const pending = await prisma.deviceCommand.findFirst({
    where: { deviceId, status: "PENDING" },
  });
  if (!pending) {
    await prisma.deviceCommand.create({
      data: { deviceId, commandType: "REFRESH", status: "PENDING" },
    });
  }
}

/** Queue a REFRESH for every screen currently assigned a given playlist. */
export async function enqueueRefreshForPlaylist(playlistId: string) {
  const devices = await prisma.device.findMany({
    where: { assignedPlaylistId: playlistId },
    select: { id: true },
  });
  await Promise.all(devices.map((d) => enqueueRefresh(d.id)));
}
