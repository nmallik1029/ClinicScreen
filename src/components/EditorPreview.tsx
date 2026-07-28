"use client";

import { useEffect, useRef, useState } from "react";
import DoctorCard, { type DoctorCardData } from "@/components/DoctorCard";

export type PreviewItem = {
  id: string;
  type: "VIDEO" | "IMAGE" | "DOCTOR";
  url: string;
  /** The clip block's visible (trimmed) play length — gap excluded. */
  duration: number;
  /** Black dead-air seconds before this clip. */
  leadingGapSeconds?: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number | null;
  doctor?: DoctorCardData | null;
};

type Located = { index: number; offset: number; start: number };

function leadingGap(item: PreviewItem | undefined) {
  return Math.max(0, item?.leadingGapSeconds ?? 0);
}

// A clip occupies its leading (black) gap plus its visible block on the clock.
function slotDuration(item: PreviewItem | undefined) {
  return leadingGap(item) + (item?.duration ?? 0);
}

function locate(items: PreviewItem[], t: number): Located {
  let acc = 0;
  for (let i = 0; i < items.length; i++) {
    const d = slotDuration(items[i]);
    if (t < acc + d || i === items.length - 1) {
      return { index: i, offset: Math.max(0, t - acc), start: acc };
    }
    acc += d;
  }
  return { index: 0, offset: 0, start: 0 };
}

function trimStart(item: PreviewItem | undefined) {
  return Math.max(0, item?.trimStartSeconds ?? 0);
}

function trimEnd(item: PreviewItem | undefined) {
  return item?.trimEndSeconds ?? trimStart(item) + (item?.duration ?? 0);
}

// The first `leadingGap` seconds of every slot are black dead air, before the
// clip itself begins.
function isBlackGap(item: PreviewItem | undefined, offset: number) {
  return offset < leadingGap(item);
}

// Where within the source video the given slot offset maps to.
function videoTimeAt(item: PreviewItem | undefined, offset: number) {
  return trimStart(item) + Math.max(0, offset - leadingGap(item));
}

function seekVideo(el: HTMLVideoElement | undefined, seconds: number) {
  if (!el) return;
  try {
    if (typeof el.fastSeek === "function") el.fastSeek(seconds);
    else el.currentTime = seconds;
  } catch {
    /* ignore unseekable states */
  }
}

/**
 * Timeline preview with a tiny playback clock. Videos stay mounted/preloaded so
 * rapid scrubbing between clips does not repeatedly destroy and recreate media
 * elements, which is the main source of black flashes during fast seeks.
 */
export default function EditorPreview({
  items,
  playing,
  seekTime,
  seekNonce,
  onTime,
  onEndedAll,
}: {
  items: PreviewItem[];
  playing: boolean;
  seekTime: number;
  seekNonce: number;
  onTime: (t: number) => void;
  onEndedAll?: () => void;
}) {
  const total = items.reduce((s, i) => s + slotDuration(i), 0);

  const itemsRef = useRef(items);
  itemsRef.current = items;
  const totalRef = useRef(total);
  totalRef.current = total;
  const playingRef = useRef(playing);
  playingRef.current = playing;
  const timeRef = useRef(seekTime);
  const videoRefs = useRef<Map<string, HTMLVideoElement>>(new Map());

  const initial = locate(items, seekTime);
  const [renderIndex, setRenderIndex] = useState(initial.index);
  const [renderOffset, setRenderOffset] = useState(initial.offset);
  const renderIndexRef = useRef(renderIndex);
  renderIndexRef.current = renderIndex;

  function syncToTime(t: number) {
    const list = itemsRef.current;
    const loc = locate(list, t);
    const clip = list[loc.index];
    timeRef.current = t;
    setRenderIndex(loc.index);
    setRenderOffset(loc.offset);
    if (clip?.type === "VIDEO" && !isBlackGap(clip, loc.offset)) {
      seekVideo(videoRefs.current.get(clip.id), videoTimeAt(clip, loc.offset));
    }
    onTime(t);
  }

  // Deliberate seek (click on ruler, +/-5s, etc.).
  useEffect(() => {
    syncToTime(seekTime);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seekNonce]);

  // Pause every hidden video; only the active visible video should play.
  useEffect(() => {
    const loc = locate(itemsRef.current, timeRef.current);
    const active = itemsRef.current[loc.index];
    videoRefs.current.forEach((video, id) => {
      if (playing && active?.id === id && !isBlackGap(active, loc.offset)) {
        video.play().catch(() => {});
      } else {
        video.pause();
      }
    });
  }, [playing, renderIndex, renderOffset]);

  useEffect(() => {
    if (!playing || total <= 0) {
      videoRefs.current.forEach((video) => video.pause());
      return;
    }

    let last = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      const list = itemsRef.current;
      const tot = totalRef.current;
      let t = timeRef.current;
      const loc = locate(list, t);
      const clip = list[loc.index];

      if (clip?.type === "VIDEO" && !isBlackGap(clip, loc.offset)) {
        const video = videoRefs.current.get(clip.id);
        if (video) {
          if (video.paused) video.play().catch(() => {});
          const start = trimStart(clip);
          const end = trimEnd(clip);
          const gap = leadingGap(clip);
          if (video.ended || video.currentTime >= end - 0.04) t = loc.start + gap + (end - start);
          else t = loc.start + gap + Math.max(0, video.currentTime - start);
        } else {
          t += dt;
        }
      } else {
        t += dt;
      }

      if (t >= tot) {
        t = 0;
        onEndedAll?.();
      }

      const next = locate(list, t);
      const nextClip = list[next.index];
      if (nextClip?.type === "VIDEO" && !isBlackGap(nextClip, next.offset)) {
        const video = videoRefs.current.get(nextClip.id);
        const target = videoTimeAt(nextClip, next.offset);
        if (video && Math.abs(video.currentTime - target) > 0.2) seekVideo(video, target);
      }
      timeRef.current = t;
      setRenderIndex(next.index);
      setRenderOffset(next.offset);
      onTime(t);
      raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing, total]);

  const clip = items[Math.min(renderIndex, items.length - 1)];
  const showBlack = isBlackGap(clip, renderOffset);

  return (
    <div className="absolute inset-0 bg-black">
      {items.map((item, index) => {
        const visible = index === renderIndex && !showBlack;
        const cls = `absolute inset-0 h-full w-full object-contain transition-opacity duration-75 ${
          visible ? "opacity-100" : "opacity-0"
        }`;

        if (item.type === "DOCTOR") {
          return (
            <div key={item.id} className={cls}>
              {item.doctor && <DoctorCard doctor={item.doctor} />}
            </div>
          );
        }

        if (item.type === "IMAGE") {
          // eslint-disable-next-line @next/next/no-img-element
          return <img key={item.id} src={item.url} alt="" className={cls} />;
        }

        return (
          <video
            key={item.id}
            ref={(el) => {
              if (el) videoRefs.current.set(item.id, el);
              else videoRefs.current.delete(item.id);
            }}
            src={item.url}
            muted
            playsInline
            preload="auto"
            className={cls}
            onLoadedMetadata={(event) => {
              if (item.id === clip?.id && !showBlack) seekVideo(event.currentTarget, videoTimeAt(clip, renderOffset));
            }}
          />
        );
      })}
    </div>
  );
}
