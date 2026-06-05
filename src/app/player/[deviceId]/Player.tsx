"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Item = {
  id: string;
  title: string;
  type: "VIDEO" | "IMAGE";
  url: string;
  duration: number;
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

export default function Player({ items }: { items: Item[] }) {
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
      if (el.currentTime > 0.05 || el.ended) {
        shouldWaitForSeek = true;
        el.currentTime = 0;
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
      if (!Number.isFinite(el.duration) || el.duration <= 0) return;
      const remainingMs = (el.duration - el.currentTime) * 1000;
      if (remainingMs <= VIDEO_ADVANCE_BEFORE_END_MS) advance();
    },
    [advance]
  );

  useEffect(() => {
    advanceInFlightRef.current = false;
  }, [index]);

  // Images advance on a timer; videos start their transition just before the end
  // so the outgoing clip never gets a chance to paint an end-of-stream black frame.
  useEffect(() => {
    if (single || currentItem.type !== "IMAGE") return;
    const t = setTimeout(advance, Math.max(2, currentItem.duration) * 1000);
    return () => clearTimeout(t);
  }, [advance, currentItem.duration, currentItem.type, single]);

  // Play the current clip. Leave the others paused on their current frame *during*
  // the crossfade (so the outgoing clip dissolves from its last frame). Once the
  // fade is done, rewind + decode the off-screen clips so they're frame-ready for
  // the next transition — including the loop back to the first clip.
  useEffect(() => {
    videoEls.current.forEach((el, id) => {
      if (id === currentItem.id) el.play().catch(() => {});
      else el.pause();
    });

    const t = setTimeout(() => {
      videoEls.current.forEach((el, id) => {
        if (id === currentItem.id) return;
        try {
          el.currentTime = 0;
        } catch {
          /* ignore */
        }
        // Nudge the decoder so frame 0 is painted even for a clip that ended.
        el.play()
          .then(() => {
            el.pause();
            try {
              el.currentTime = 0;
            } catch {
              /* ignore */
            }
          })
          .catch(() => {});
      });
    }, FADE_MS + 60);

    return () => clearTimeout(t);
  }, [currentItem.id, index]);

  // Mount the current clip plus the previous (fading out) and next (preloaded), in
  // stable index order so the elements aren't reordered between renders.
  const mounted = single
    ? [curIdx]
    : Array.from(new Set([prevIdx, curIdx, nextIdx])).sort((a, b) => a - b);

  return (
    <div className="fixed inset-0 bg-black">
      {mounted.map((i) => {
        const item = items[i];
        const isCurrent = i === curIdx;
        const cls = `absolute inset-0 h-full w-full object-cover transition-opacity ease-linear duration-500 ${
          isCurrent ? "opacity-100" : "opacity-0"
        }`;

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
            loop={single}
            onTimeUpdate={
              isCurrent && !single ? (event) => advanceBeforeVideoEnds(event.currentTarget) : undefined
            }
            onEnded={isCurrent && !single ? advance : undefined}
            onError={isCurrent ? advance : undefined}
          />
        );
      })}
    </div>
  );
}
