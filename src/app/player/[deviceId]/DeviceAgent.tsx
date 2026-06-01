"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const HEARTBEAT_MS = 30_000;
const POLL_MS = 12_000;

/**
 * Invisible agent that makes the browser player behave like a real display:
 * reports heartbeat and polls for pending commands (REFRESH). Failures are
 * swallowed so playback is never interrupted.
 */
export default function DeviceAgent({ deviceId, token }: { deviceId: string; token: string }) {
  const router = useRouter();

  useEffect(() => {
    let active = true;
    const base = `/api/player/${deviceId}`;
    const q = `?t=${encodeURIComponent(token)}`;

    const beat = () => fetch(`${base}/heartbeat${q}`, { method: "POST" }).catch(() => {});
    beat();
    const heartbeat = setInterval(beat, HEARTBEAT_MS);

    const poll = async () => {
      try {
        const res = await fetch(`${base}/commands${q}`, { cache: "no-store" });
        if (!res.ok) return;
        const commands: { id: string; commandType: string }[] = await res.json();
        let refreshed = false;
        for (const c of commands) {
          if (c.commandType === "REFRESH") {
            await fetch(`${base}/commands/${c.id}/complete${q}`, { method: "POST" }).catch(() => {});
            refreshed = true;
          }
        }
        if (refreshed && active) router.refresh(); // refetch assigned playlist
      } catch {
        // ignore transient errors
      }
    };
    const polling = setInterval(poll, POLL_MS);

    return () => {
      active = false;
      clearInterval(heartbeat);
      clearInterval(polling);
    };
  }, [deviceId, token, router]);

  return null;
}
