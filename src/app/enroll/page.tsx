"use client";

import { useEffect, useState } from "react";
import FullscreenBody from "@/components/FullscreenBody";

// Device-facing pairing screen. Loaded by the ClinicScreen Player app on a TV PC.
// If this device was already paired (token saved locally) it jumps straight to the
// player; otherwise it requests a pairing code, displays it, and polls until an
// admin claims it — then stores the screen's identity and switches to playback.
const DEVICE_KEY = "cs_device";
const POLL_INTERVAL_MS = 3000;

type Phase = "starting" | "waiting" | "claimed" | "offline";

export default function EnrollPage() {
  const [phase, setPhase] = useState<Phase>("starting");
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    // Already paired? Go straight to playback.
    try {
      const saved = localStorage.getItem(DEVICE_KEY);
      if (saved) {
        const { deviceId, token } = JSON.parse(saved);
        if (deviceId && token) {
          window.location.replace(`/player/${deviceId}?t=${encodeURIComponent(token)}`);
          return;
        }
      }
    } catch {
      /* fall through to fresh enrollment */
    }

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function begin() {
      try {
        const res = await fetch("/api/enroll/start", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        if (!res.ok) throw new Error("start failed");
        const { enrollmentId, code: newCode, secret } = await res.json();
        if (cancelled) return;
        setCode(newCode);
        setPhase("waiting");
        poll(enrollmentId, secret);
      } catch {
        if (cancelled) return;
        setPhase("offline");
        timer = setTimeout(begin, 5000);
      }
    }

    async function poll(enrollmentId: string, secret: string) {
      try {
        const res = await fetch("/api/enroll/poll", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ enrollmentId, secret }),
        });
        const data = await res.json();
        if (cancelled) return;

        if (data.status === "claimed") {
          localStorage.setItem(
            DEVICE_KEY,
            JSON.stringify({ deviceId: data.deviceId, token: data.token }),
          );
          setPhase("claimed");
          window.location.replace(
            `/player/${data.deviceId}?t=${encodeURIComponent(data.token)}`,
          );
          return;
        }
        if (data.status === "expired" || data.status === "invalid") {
          // Code lapsed before anyone paired it — start over with a fresh one.
          setCode(null);
          setPhase("starting");
          begin();
          return;
        }
        timer = setTimeout(() => poll(enrollmentId, secret), POLL_INTERVAL_MS);
      } catch {
        if (cancelled) return;
        timer = setTimeout(() => poll(enrollmentId, secret), POLL_INTERVAL_MS * 2);
      }
    }

    begin();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const grouped = code && code.length === 6 ? `${code.slice(0, 3)}-${code.slice(3)}` : code;

  return (
    <div
      className="fixed inset-0 flex flex-col items-center justify-center px-6 text-center text-white"
      style={{ backgroundColor: "#0b1e3b" }}
    >
      <FullscreenBody />
      <div className="text-xl font-semibold tracking-tight text-blue-300">ClinicScreen</div>

      {phase === "waiting" && code ? (
        <>
          <p className="mt-10 text-lg text-blue-100/80">Pair this screen</p>
          <div className="mt-4 font-mono text-7xl font-bold tracking-[0.2em] tabular-nums">
            {grouped}
          </div>
          <p className="mt-8 max-w-md text-sm text-blue-100/60">
            In ClinicScreen, open your practice → <span className="font-medium">Screens</span> →{" "}
            <span className="font-medium">Pair a screen</span> and enter this code.
          </p>
          <p className="mt-6 text-xs text-blue-100/40">Waiting to be paired…</p>
        </>
      ) : phase === "offline" ? (
        <p className="mt-10 text-sm text-blue-100/60">
          Can&apos;t reach ClinicScreen. Retrying…
        </p>
      ) : (
        <p className="mt-10 text-sm text-blue-100/60">Setting up…</p>
      )}
    </div>
  );
}
