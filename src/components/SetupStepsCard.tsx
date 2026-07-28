"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { SetupStep } from "@/lib/setup-steps";

/**
 * Vertical, glassy "Setup" card for the Screens sidebar. Shows the ordered steps
 * while setup is incomplete. The moment the last step is done it shows a brief
 * "Setup complete" message, then removes itself for good (remembered per practice
 * via localStorage, so it doesn't linger forever or reappear on every visit).
 */
export default function SetupStepsCard({
  practiceId,
  steps,
}: {
  practiceId: string;
  steps: SetupStep[];
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);
  const allDone = currentIndex === -1;
  const ackKey = `cs-setup-ack-${practiceId}`;

  // Start "acknowledged" so a completed setup never flashes before we read storage.
  const [acknowledged, setAcknowledged] = useState(true);

  useEffect(() => {
    if (!allDone) {
      // Setup is incomplete (again) — allow the completion message next time.
      try {
        localStorage.removeItem(ackKey);
      } catch {
        /* ignore */
      }
      setAcknowledged(false);
      return;
    }
    let already = true;
    try {
      already = localStorage.getItem(ackKey) === "1";
    } catch {
      /* ignore */
    }
    setAcknowledged(already);
    if (!already) {
      const t = setTimeout(() => {
        try {
          localStorage.setItem(ackKey, "1");
        } catch {
          /* ignore */
        }
        setAcknowledged(true);
      }, 4000);
      return () => clearTimeout(t);
    }
  }, [allDone, ackKey]);

  if (allDone) {
    if (acknowledged) return null; // gone for good
    return (
      <aside className="soft-enter w-full shrink-0 lg:w-[300px]">
        <div className="flex items-center gap-3 rounded-2xl border border-green-300 bg-green-50/70 p-4 shadow-sm backdrop-blur-xl dark:border-green-900/60 dark:bg-green-950/40">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <path d="M20 6 9 17l-5-5" />
            </svg>
          </span>
          <div>
            <p className="text-sm font-semibold text-green-800 dark:text-green-300">Setup complete</p>
            <p className="text-xs text-green-700/80 dark:text-green-400/80">Every screen is configured.</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="h-fit w-full shrink-0 rounded-2xl border border-white/50 bg-white/60 p-4 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-slate-900/50 lg:sticky lg:top-6 lg:w-[300px]">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">Setup</h3>
        <span className="text-xs text-slate-400">
          {doneCount}/{steps.length}
        </span>
      </div>

      <ol className="mt-4 space-y-4">
        {steps.map((step, i) => {
          const isCurrent = i === currentIndex;
          const href = step.tour
            ? `/practices/${practiceId}/${step.href}?tour=${step.tour}`
            : `/practices/${practiceId}/${step.href}`;
          return (
            <li key={step.key} className="flex gap-3">
              <span
                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  step.done
                    ? "bg-green-500 text-white"
                    : isCurrent
                      ? "bg-blue-600 text-white"
                      : "bg-slate-200 text-slate-500 dark:bg-slate-700 dark:text-slate-300"
                }`}
              >
                {step.done ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                    <path d="M20 6 9 17l-5-5" />
                  </svg>
                ) : (
                  i + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p
                  className={`text-sm font-medium ${
                    step.done
                      ? "text-slate-400 dark:text-slate-500"
                      : isCurrent
                        ? "text-blue-700 dark:text-blue-300"
                        : "text-slate-600 dark:text-slate-300"
                  }`}
                >
                  {step.shortLabel}
                </p>
                {isCurrent && (
                  <>
                    <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{step.detail}</p>
                    <Link
                      href={href}
                      className="mt-2 inline-flex items-center rounded-md bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700"
                    >
                      {step.cta}
                    </Link>
                  </>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </aside>
  );
}
