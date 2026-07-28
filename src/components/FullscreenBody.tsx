"use client";

import { useEffect } from "react";

// Fullscreen pages (player, enroll) don't scroll, so they must opt out of the
// global `scrollbar-gutter: stable` — otherwise the reserved gutter shows as a
// blank strip down the right edge. They're also kiosk screens, so the mouse
// cursor is hidden (the Wayland/cage kiosk has no X11 unclutter to do it).
export default function FullscreenBody() {
  useEffect(() => {
    const el = document.documentElement;
    const prevGutter = el.style.scrollbarGutter;
    const prevOverflow = el.style.overflow;
    const prevCursor = el.style.cursor;
    el.style.scrollbarGutter = "auto";
    el.style.overflow = "hidden";
    el.style.cursor = "none";
    return () => {
      el.style.scrollbarGutter = prevGutter;
      el.style.overflow = prevOverflow;
      el.style.cursor = prevCursor;
    };
  }, []);
  return null;
}
