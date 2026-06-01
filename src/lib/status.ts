// A screen is considered online if it has checked in (heartbeat) recently.
export const ONLINE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes

export type DisplayStatus = "ONLINE" | "OFFLINE";

export function deviceStatus(lastSeenAt: Date | null): DisplayStatus {
  if (!lastSeenAt) return "OFFLINE";
  return Date.now() - lastSeenAt.getTime() < ONLINE_WINDOW_MS ? "ONLINE" : "OFFLINE";
}
