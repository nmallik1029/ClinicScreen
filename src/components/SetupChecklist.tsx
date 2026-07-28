import Link from "next/link";
import type { SetupStep } from "@/lib/setup-steps";

export type { SetupStep };

/** Build the destination link, launching the page walkthrough when one exists. */
function stepHref(practiceId: string, step: SetupStep) {
  const base = `/practices/${practiceId}/${step.href}`;
  return step.tour ? `${base}?tour=${step.tour}` : base;
}

/**
 * Guided, state-aware setup checklist. Surfaces the single next thing to do as a
 * big callout, with the full ordered list below for context. Built for
 * technicians who won't learn the system — one clear action at a time.
 */
export default function SetupChecklist({
  practiceId,
  steps,
}: {
  practiceId: string;
  steps: SetupStep[];
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const currentIndex = steps.findIndex((s) => !s.done);
  const allDone = currentIndex === -1;
  const current = allDone ? null : steps[currentIndex];

  return (
    <section>
      {/* The one thing to do next */}
      {current ? (
        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-6 shadow-sm dark:border-blue-900/60 dark:bg-blue-950/40">
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-700 dark:text-blue-300">
            Next step · {currentIndex + 1} of {steps.length}
          </p>
          <h2 className="mt-2 text-2xl font-semibold">{current.title}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            {current.description}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Link
              href={stepHref(practiceId, current)}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              {current.cta}
            </Link>
            <span className="text-xs text-slate-500 dark:text-slate-400">{current.detail}</span>
          </div>
          <p className="mt-3 text-xs text-blue-700/80 dark:text-blue-300/80">
            We&apos;ll walk you through it and show you exactly where to click.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-green-200 bg-green-50 p-6 shadow-sm dark:border-green-900/60 dark:bg-green-950/40">
          <h2 className="text-2xl font-semibold text-green-800 dark:text-green-300">You&apos;re all set</h2>
          <p className="mt-2 text-sm text-green-700 dark:text-green-400">
            Every screen is placed and playing a playlist. Nothing else to do right now.
          </p>
        </div>
      )}

      {/* Full ordered checklist */}
      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-medium text-slate-600 dark:text-slate-400">Setup checklist</h3>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            {doneCount} of {steps.length} done
          </span>
        </div>
        <ol className="space-y-2">
          {steps.map((step, i) => {
            const isCurrent = i === currentIndex;
            return (
              <li
                key={step.key}
                className={`flex items-center gap-4 rounded-xl border p-4 transition-colors ${
                  isCurrent
                    ? "border-blue-300 bg-white dark:border-blue-900/70 dark:bg-slate-900"
                    : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
                }`}
              >
                <span
                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold ${
                    step.done
                      ? "bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300"
                      : isCurrent
                        ? "bg-blue-600 text-white"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                  }`}
                >
                  {step.done ? (
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <p
                    className={`text-sm font-medium ${
                      step.done ? "text-slate-400 line-through dark:text-slate-500" : ""
                    }`}
                  >
                    {step.title}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{step.detail}</p>
                </div>

                {step.done ? (
                  <span className="shrink-0 text-xs font-medium text-green-600 dark:text-green-400">Done</span>
                ) : (
                  <Link
                    href={stepHref(practiceId, step)}
                    className={`shrink-0 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                      isCurrent
                        ? "bg-blue-600 text-white hover:bg-blue-700"
                        : "border border-slate-300 text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                    }`}
                  >
                    {isCurrent ? step.cta : "Go"}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </div>
    </section>
  );
}
