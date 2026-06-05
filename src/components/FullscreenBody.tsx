"use client";

import { useEffect } from "react";

// Fullscreen pages (player, enroll) don't scroll, so they must opt out of the
// global `scrollbar-gutter: stable` — otherwise the reserved gutter shows as a
// blank strip down the right edge.
export default function FullscreenBody() {
  useEffect(() => {
    const el = document.documentElement;
    const prevGutter = el.style.scrollbarGutter;
    const prevOverflow = el.style.overflow;
    el.style.scrollbarGutter = "auto";
    el.style.overflow = "hidden";
    return () => {
      el.style.scrollbarGutter = prevGutter;
      el.style.overflow = prevOverflow;
    };
  }, []);
  return null;
}
