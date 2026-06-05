"use client";

import { useEffect } from "react";

// Shown when a device's stored token no longer matches (e.g. the screen's link was
// reset). Clears the stale identity and returns to enrollment so the TV re-pairs
// on its own instead of getting stuck.
export default function Repair() {
  useEffect(() => {
    try {
      localStorage.removeItem("cs_device");
    } catch {
      /* ignore */
    }
    const t = setTimeout(() => window.location.replace("/enroll"), 3000);
    return () => clearTimeout(t);
  }, []);
  return null;
}
