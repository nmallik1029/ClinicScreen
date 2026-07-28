"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { TOURS, type TourStep } from "@/lib/tours";

type Rect = { top: number; left: number; width: number; height: number };

const PAD = 6; // breathing room around the spotlighted element

export default function Walkthrough() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const isPlayerSurface = pathname === "/enroll" || pathname.startsWith("/player/");
  const tourId = searchParams.get("tour");
  const steps: TourStep[] | null = tourId ? TOURS[tourId] ?? null : null;

  const [index, setIndex] = useState(0);
  const [rect, setRect] = useState<Rect | null>(null);
  // "locating" = still searching for the target (render nothing, so the centered
  // fallback never flashes before we snap to the element); "found" = positioned
  // on the target; "missing" = gave up, show the centered fallback.
  const [phase, setPhase] = useState<"locating" | "found" | "missing">("locating");
  // Hide instantly on exit instead of waiting for the ?tour= param to clear —
  // otherwise there's a one-frame flash of the centered fallback overlay.
  const [dismissed, setDismissed] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);

  // Reset whenever a tour is (re)launched.
  useEffect(() => {
    setIndex(0);
    setDismissed(false);
  }, [tourId]);

  const step = steps?.[index] ?? null;

  // Locate + measure the current target. The element may not be mounted yet
  // (page still rendering), so poll briefly before giving up and centering.
  const measure = useCallback(() => {
    if (!step) return;
    const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
    if (!el) {
      setRect(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRect({ top: r.top, left: r.left, width: r.width, height: r.height });
  }, [step]);

  useEffect(() => {
    if (!step) return;
    // On first load (especially after a client-side nav), the target can mount a
    // few hundred ms after this runs. A fixed frame budget would give up too soon
    // and leave the tooltip stuck in its centered fallback — so poll by elapsed
    // time instead, and re-measure once after the smooth scroll settles.
    let cancelled = false;
    let raf = 0;
    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const start = performance.now();
    const MAX_WAIT_MS = 5000;
    setPhase("locating");

    const tick = () => {
      if (cancelled) return;
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        measure();
        setPhase("found");
        // Smooth scroll keeps moving the element; re-measure once it's stopped.
        settleTimer = setTimeout(() => {
          if (!cancelled) measure();
        }, 400);
        return;
      }
      if (performance.now() - start < MAX_WAIT_MS) raf = requestAnimationFrame(tick);
      else {
        setRect(null);
        setPhase("missing");
      }
    };
    tick();
    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
      if (settleTimer) clearTimeout(settleTimer);
    };
  }, [step, measure]);

  // Keep the spotlight glued to the element as the page scrolls/resizes.
  useEffect(() => {
    if (!step) return;
    window.addEventListener("scroll", measure, true);
    window.addEventListener("resize", measure);
    return () => {
      window.removeEventListener("scroll", measure, true);
      window.removeEventListener("resize", measure);
    };
  }, [step, measure]);

  const end = useCallback(() => {
    setDismissed(true);
    // Drop the ?tour= param so it doesn't relaunch on refresh/back.
    router.replace(pathname, { scroll: false });
  }, [router, pathname]);

  // Keyboard: Esc to exit, arrows/enter to move.
  useEffect(() => {
    if (!steps) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") end();
      else if (e.key === "ArrowRight" || e.key === "Enter") setIndex((i) => Math.min(i + 1, steps!.length - 1));
      else if (e.key === "ArrowLeft") setIndex((i) => Math.max(i - 1, 0));
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [steps, end]);

  // While still locating the target, render nothing — this prevents the centered
  // fallback from flashing on first show before we snap onto the element.
  if (isPlayerSurface || !steps || !step || dismissed || phase === "locating") return null;

  const isLast = index === steps.length - 1;
  const isFirst = index === 0;

  // Tooltip placement: below the target if there's room, otherwise above.
  // Centered fallback when the target couldn't be found.
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1200;
  const TOOLTIP_W = 340;

  let tooltipStyle: React.CSSProperties;
  if (rect) {
    const below = vh - (rect.top + rect.height) > 200;
    const left = Math.min(Math.max(rect.left, 12), vw - TOOLTIP_W - 12);
    tooltipStyle = below
      ? { top: rect.top + rect.height + 12, left }
      : { top: rect.top - 12, left, transform: "translateY(-100%)" };
  } else {
    tooltipStyle = { top: "50%", left: "50%", transform: "translate(-50%, -50%)" };
  }

  return (
    <>
      {/* Spotlight: a ring over the target with a huge box-shadow dimming the rest.
          pointer-events:none so the real element underneath stays usable. */}
      {rect && (
        <div
          aria-hidden
          className="pointer-events-none fixed z-[60] rounded-lg ring-2 ring-blue-500 transition-all duration-200"
          style={{
            top: rect.top - PAD,
            left: rect.left - PAD,
            width: rect.width + PAD * 2,
            height: rect.height + PAD * 2,
            boxShadow: "0 0 0 9999px rgba(2, 6, 23, 0.55)",
          }}
        />
      )}
      {/* When the target is missing, still dim the screen so the tooltip reads. */}
      {!rect && <div aria-hidden className="fixed inset-0 z-[60] bg-slate-950/55" />}

      {/* Coachmark */}
      <div
        ref={tooltipRef}
        className="fixed z-[61] w-[340px] max-w-[calc(100vw-24px)] rounded-xl border border-slate-200 bg-white p-4 shadow-2xl dark:border-slate-700 dark:bg-slate-900"
        style={tooltipStyle}
        role="dialog"
        aria-modal="false"
      >
        <div className="flex items-start justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Step {index + 1} of {steps.length}
          </p>
          <button
            type="button"
            onClick={end}
            className="-mr-1 -mt-1 rounded p-1 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
            aria-label="Exit walkthrough"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
        <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{step.body}</p>

        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={end}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
          >
            Skip
          </button>
          <div className="flex items-center gap-2">
            {!isFirst && (
              <button
                type="button"
                onClick={() => setIndex((i) => Math.max(i - 1, 0))}
                className="rounded-md border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                Back
              </button>
            )}
            <button
              type="button"
              onClick={() => (isLast ? end() : setIndex((i) => i + 1))}
              className="rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-700"
            >
              {isLast ? "Done" : "Next"}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
