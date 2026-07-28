"use client";

import { useRef } from "react";

/**
 * Renders a still frame from a video (a hair past the start) for use as a
 * thumbnail / timeline strip. Avoids canvas (no cross-origin tainting with R2):
 * it's just a muted, non-playing <video> nudged to a visible frame.
 */
export default function VideoFrame({ url, className }: { url: string; className?: string }) {
  const ref = useRef<HTMLVideoElement>(null);
  return (
    <video
      ref={ref}
      src={url}
      muted
      playsInline
      preload="metadata"
      tabIndex={-1}
      className={className}
      onLoadedData={() => {
        const v = ref.current;
        if (v && v.currentTime < 0.05) {
          try {
            v.currentTime = Math.min(0.1, (v.duration || 1) / 2);
          } catch {
            /* ignore */
          }
        }
      }}
    />
  );
}
