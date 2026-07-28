"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import DoctorCard, { type DoctorCardData } from "@/components/DoctorCard";

type Item = {
  id: string;
  title: string;
  type: "VIDEO" | "IMAGE" | "BLACK" | "DOCTOR";
  url: string;
  duration: number;
  trimStartSeconds?: number;
  trimEndSeconds?: number | null;
  doctor?: DoctorCardData | null;
};

const FADE_MS = 500;
const HAVE_NOTHING = 0;
const HAVE_CURRENT_DATA = 2;
const VIDEO_ADVANCE_BEFORE_END_MS = FADE_MS + 250;
const VIDEO_READY_TIMEOUT_MS = 1400;

function waitForVideoEvent(el: HTMLVideoElement, eventName: "seeked" | "loadeddata" | "canplay") {
  return new Promise<void>((resolve) => {
    let done = false;
    let timer: number;

    const cleanup = () => {
      window.clearTimeout(timer);
      el.removeEventListener(eventName, finish);
    };
    const finish = () => {
      if (done) return;
      done = true;
      cleanup();
      resolve();
    };

    timer = window.setTimeout(finish, VIDEO_READY_TIMEOUT_MS);
    el.addEventListener(eventName, finish, { once: true });
  });
}

async function waitForVideoReady(el: HTMLVideoElement) {
  if (el.readyState >= HAVE_CURRENT_DATA) return Promise.resolve();

  await Promise.race([waitForVideoEvent(el, "loadeddata"), waitForVideoEvent(el, "canplay")]);
}

function clipStart(item: Item) {
  return Math.max(0, item.trimStartSeconds ?? 0);
}

function clipEnd(item: Item, el: HTMLVideoElement) {
  return item.trimEndSeconds ?? (Number.isFinite(el.duration) ? el.duration : null);
}

function waitForDecodedFrame(el: HTMLVideoElement) {
  const requestFrame = el.requestVideoFrameCallback?.bind(el);
  if (!requestFrame) {
    return new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));
  }

  return new Promise<void>((resolve) => {
    let done = false;
    const timer = window.setTimeout(finish, VIDEO_READY_TIMEOUT_MS);

    function finish() {
      if (done) return;
      done = true;
      window.clearTimeout(timer);
      resolve();
    }

    requestFrame(finish);
  });
}

export default function Player({ items, contained = false }: { items: Item[]; contained?: boolean }) {
  const len = items.length;
  const single = len === 1;
  const [index, setIndex] = useState(0);

  const curIdx = index % len;
  const prevIdx = (index - 1 + len) % len;
  const nextIdx = (index + 1) % len;
  const currentItem = items[curIdx];

  const videoEls = useRef<Map<string, HTMLVideoElement>>(new Map());
  const advanceInFlightRef = useRef(false);
  const transitionRef = useRef(0);

  const prepareVideo = useCallback(async (item: Item) => {
    if (item.type !== "VIDEO") return;

    const el = videoEls.current.get(item.id);
    if (!el) return;

    let shouldWaitForSeek = false;
    try {
      el.pause();
      if (el.readyState === HAVE_NOTHING) el.load();
      const start = clipStart(item);
      if (Math.abs(el.currentTime - start) > 0.05 || el.ended) {
        shouldWaitForSeek = true;
        el.currentTime = start;
      }
    } catch {
      /* ignore */
    }

    if (shouldWaitForSeek) await waitForVideoEvent(el, "seeked");
    await waitForVideoReady(el);
    await el.play().catch(() => {});
    await waitForDecodedFrame(el);
  }, []);

  const advance = useCallback(() => {
    if (single || advanceInFlightRef.current) return;

    advanceInFlightRef.current = true;
    const transitionId = ++transitionRef.current;
    const targetIndex = (index + 1) % len;
    const targetItem = items[targetIndex];

    void prepareVideo(targetItem).finally(() => {
      if (transitionRef.current !== transitionId) return;
      setIndex(targetIndex);
    });
  }, [index, items, len, prepareVideo, single]);

  const advanceBeforeVideoEnds = useCallback(
    (el: HTMLVideoElement) => {
      const end = clipEnd(currentItem, el);
      if (end == null || end <= 0) return;
      const remainingMs = (end - el.currentTime) * 1000;
      if (remainingMs <= VIDEO_ADVANCE_BEFORE_END_MS) advance();
    },
    [advance, currentItem]
  );

  const loopTrimmedSingle = useCallback(
    (el: HTMLVideoElement) => {
      if (!single || currentItem.type !== "VIDEO") return;
      const end = clipEnd(currentItem, el);
      if (end == null || el.currentTime < end - 0.04) return;
      try {
        el.currentTime = clipStart(currentItem);
        el.play().catch(() => {});
      } catch {
        /* ignore */
      }
    },
    [currentItem, single]
  );

  useEffect(() => {
    advanceInFlightRef.current = false;
  }, [index]);

  // Images and black gaps advance on a timer; videos start their transition just
  // before the end so the outgoing clip never paints an end-of-stream black frame.
  useEffect(() => {
    if (single || currentItem.type === "VIDEO") return;
    const seconds = currentItem.type === "BLACK" ? currentItem.duration : Math.max(2, currentItem.duration);
    const t = setTimeout(advance, Math.max(0.2, seconds) * 1000);
    return () => clearTimeout(t);
  }, [advance, currentItem.duration, currentItem.type, single]);

  // Play the current clip. Leave the others paused on their current frame *during*
  // the crossfade (so the outgoing clip dissolves from its last frame). Once the
  // fade is done, rewind + decode the off-screen clips so they're frame-ready for
  // the next transition — including the loop back to the first clip.
  useEffect(() => {
    videoEls.current.forEach((el, id) => {
      if (id === currentItem.id) {
        if (el.currentTime < clipStart(currentItem)) {
          try {
            el.currentTime = clipStart(currentItem);
          } catch {
            /* ignore */
          }
        }
        el.play().catch(() => {});
      } else el.pause();
    });

    const t = setTimeout(() => {
      videoEls.current.forEach((el, id) => {
        if (id === currentItem.id) return;
        const item = items.find((candidate) => candidate.id === id);
        const start = item ? clipStart(item) : 0;
        try {
          el.currentTime = start;
        } catch {
          /* ignore */
        }
        // Nudge the decoder so frame 0 is painted even for a clip that ended.
        el.play()
          .then(() => {
            el.pause();
            try {
              el.currentTime = start;
            } catch {
              /* ignore */
            }
          })
          .catch(() => {});
      });
    }, FADE_MS + 60);

    return () => clearTimeout(t);
  }, [currentItem, index, items]);

  // Mount the current clip plus the previous (fading out) and next (preloaded), in
  // stable index order so the elements aren't reordered between renders.
  const mounted = single
    ? [curIdx]
    : Array.from(new Set([prevIdx, curIdx, nextIdx])).sort((a, b) => a - b);

  return (
    <div className={`${contained ? "absolute" : "fixed"} inset-0 bg-black`}>
      {mounted.map((i) => {
        const item = items[i];
        const isCurrent = i === curIdx;
        const cls = `absolute inset-0 h-full w-full object-cover transition-opacity ease-linear duration-500 ${
          isCurrent ? "opacity-100" : "opacity-0"
        }`;

        if (item.type === "BLACK") {
          return <div key={item.id} className={`${cls} bg-black`} />;
        }

        if (item.type === "DOCTOR") {
          return (
            <div key={item.id} className={cls}>
              {item.doctor && <DoctorCard doctor={item.doctor} />}
            </div>
          );
        }

        if (item.type === "IMAGE") {
          // eslint-disable-next-line @next/next/no-img-element
          return (
            <img
              key={item.id}
              src={item.url}
              alt=""
              className={cls}
              onError={isCurrent ? advance : undefined}
            />
          );
        }

        return (
          <video
            key={item.id}
            ref={(el) => {
              if (el) videoEls.current.set(item.id, el);
              else videoEls.current.delete(item.id);
            }}
            src={item.url}
            className={cls}
            muted
            playsInline
            preload="auto"
            loop={single && !item.trimStartSeconds && !item.trimEndSeconds}
            onLoadedMetadata={
              isCurrent
                ? (event) => {
                    try {
                      event.currentTarget.currentTime = clipStart(item);
                    } catch {
                      /* ignore */
                    }
                  }
                : undefined
            }
            onTimeUpdate={
              isCurrent
                ? (event) => {
                    if (single) loopTrimmedSingle(event.currentTarget);
                    else advanceBeforeVideoEnds(event.currentTarget);
                  }
                : undefined
            }
            onEnded={isCurrent && !single ? advance : undefined}
            onError={isCurrent ? advance : undefined}
          />
        );
      })}
    </div>
  );
}
