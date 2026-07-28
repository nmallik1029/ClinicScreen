"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SetupStep } from "@/lib/setup-steps";
import { STEP_COMPLETE_EVENT } from "@/lib/step-complete";

/**
 * Persistent, glassy setup progress bar pinned to the bottom of every practice
 * page (except the checklist/overview itself). Shows the ordered steps as a
 * horizontal checklist that stays put while scrolling, and plays a completion
 * animation when a step is finished before the user is returned to the checklist.
 */
export default function SetupProgressBar({
  practiceId,
  steps,
}: {
  practiceId: string;
  steps: SetupStep[];
}) {
  const pathname = usePathname();
  // The just-completed step (drives the pop/check animation).
  const [completedKey, setCompletedKey] = useState<string | null>(null);

  useEffect(() => {
    function onComplete(e: Event) {
      const key = (e as CustomEvent<{ key: string }>).detail?.key;
      if (key) setCompletedKey(key);
    }
    window.addEventListener(STEP_COMPLETE_EVENT, onComplete);
    return () => window.removeEventListener(STEP_COMPLETE_EVENT, onComplete);
  }, []);

  const overview = `/practices/${practiceId}`;
  // Screens is the home base and already shows the glassy steps card.
  const home = `/practices/${practiceId}/screens`;
  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);
  const allDone = currentIndex === -1;

  // Overall fill %, counting the in-flight completion optimistically.
  const optimisticDone = useMemo(() => {
    const extra = completedKey && !steps.find((s) => s.key === completedKey)?.done ? 1 : 0;
    return Math.min(doneCount + extra, steps.length);
  }, [completedKey, doneCount, steps]);

  // Hidden on the home/checklist surfaces, the immersive editor, and once done.
  if (
    pathname === overview ||
    pathname === home ||
    pathname.endsWith("/edit") ||
    allDone ||
    steps.length === 0
  ) {
    return null;
  }

  const fillPct = (optimisticDone / steps.length) * 100;

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-3">
      <div className="pointer-events-auto w-full max-w-[1100px] overflow-hidden rounded-2xl border border-white/40 bg-white/70 shadow-[0_-2px_24px_rgba(2,6,23,0.18)] backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/60">
        {/* Top progress fill line */}
        <div className="h-1 w-full bg-slate-200/60 dark:bg-slate-700/50">
          <div
            className="h-full rounded-r-full bg-gradient-to-r from-blue-500 to-blue-600 transition-[width] duration-700 ease-out"
            style={{ width: `${fillPct}%` }}
          />
        </div>

        {/* Extra right padding on narrower viewports so the last step never tucks
            under the floating theme toggle (fixed bottom-right). */}
        <div className="flex items-center gap-3 px-4 py-2.5 max-[1220px]:pr-16">
          <Link
            href={overview}
            className="hidden shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 sm:block"
          >
            Setup
            <span className="ml-1 tabular-nums text-slate-400 dark:text-slate-500">
              {optimisticDone}/{steps.length}
            </span>
          </Link>

          <ol className="flex flex-1 items-center gap-1 overflow-x-auto sm:gap-2">
            {steps.map((step, i) => {
              const isCompleting = completedKey === step.key;
              const done = step.done || isCompleting;
              const isCurrent = i === currentIndex && !done;
              const href = step.tour
                ? `/practices/${practiceId}/${step.href}?tour=${step.tour}`
                : `/practices/${practiceId}/${step.href}`;

              return (
                <li key={step.key} className="flex min-w-0 flex-1 items-center gap-1 sm:gap-2">
                  <Link
                    href={href}
                    title={step.title}
                    className={`group flex min-w-0 items-center gap-2 rounded-full px-2 py-1 transition-colors ${
                      isCurrent
                        ? "bg-blue-50 dark:bg-blue-950/50"
                        : "hover:bg-slate-100/70 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <span
                      className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold transition-colors ${
                        done
                          ? "bg-green-500 text-white"
                          : isCurrent
                            ? "bg-blue-600 text-white"
                            : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                      } ${isCompleting ? "animate-step-pop" : ""}`}
                    >
                      {done ? (
                        <svg
                          width="13"
                          height="13"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="3.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden
                          className={isCompleting ? "animate-check-draw" : ""}
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </span>
                    <span
                      className={`truncate text-xs font-medium ${
                        isCurrent
                          ? "text-blue-700 dark:text-blue-300"
                          : done
                            ? "text-slate-400 dark:text-slate-500"
                            : "text-slate-600 dark:text-slate-300"
                      }`}
                    >
                      {step.shortLabel}
                    </span>
                  </Link>
                  {i < steps.length - 1 && (
                    <span
                      aria-hidden
                      className={`hidden h-px flex-1 sm:block ${
                        done ? "bg-green-300 dark:bg-green-800" : "bg-slate-200 dark:bg-slate-700"
                      }`}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </div>
      </div>
    </div>
  );
}
