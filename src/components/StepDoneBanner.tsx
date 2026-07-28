"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import type { SetupStep } from "@/lib/setup-steps";

const MESSAGES: Record<string, string> = {
  pair: "Screen paired",
  place: "Location added",
  media: "Media uploaded",
  playlist: "Playlist created",
  assign: "Playlist assigned",
};

/**
 * Confirmation shown on the checklist after a step is completed elsewhere (the
 * form redirects here with `?done=<key>`). Auto-clears the URL param so it
 * doesn't reappear on refresh, and fades out on its own.
 */
export default function StepDoneBanner({ steps }: { steps: SetupStep[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const done = searchParams.get("done");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!done) return;
    setVisible(true);
    // Drop the param so a refresh/back doesn't re-show the banner.
    router.replace(pathname, { scroll: false });
    const t = setTimeout(() => setVisible(false), 6000);
    return () => clearTimeout(t);
  }, [done, pathname, router]);

  if (!done || !visible) return null;

  const allDone = steps.every((s) => s.done);
  const message = MESSAGES[done] ?? "Step complete";

  return (
    <div
      role="status"
      className="mt-6 flex items-center gap-3 rounded-xl border border-green-300 bg-green-50 px-4 py-3 text-sm shadow-sm transition-opacity dark:border-green-900/60 dark:bg-green-950/40"
    >
      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500 text-white">
        <svg
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="3.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className="animate-check-draw"
        >
          <path d="M20 6 9 17l-5-5" />
        </svg>
      </span>
      <div>
        <p className="font-semibold text-green-800 dark:text-green-300">{message}</p>
        <p className="text-xs text-green-700/80 dark:text-green-400/80">
          {allDone ? "That's everything — you're all set." : "Here's what's next."}
        </p>
      </div>
      <button
        type="button"
        onClick={() => setVisible(false)}
        className="ml-auto rounded p-1 text-green-700/60 hover:text-green-900 dark:text-green-400/60 dark:hover:text-green-200"
        aria-label="Dismiss"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>
    </div>
  );
}
