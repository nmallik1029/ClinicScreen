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
