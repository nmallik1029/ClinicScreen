/**
 * Loading skeleton for the practice tab pages. Rendered via each route's
 * loading.tsx so navigation shows an instant placeholder (matching the Tabs +
 * card layout) instead of a frozen pause while the server component fetches.
 */
export default function PageSkeleton() {
  return (
    <div className="animate-pulse" aria-hidden>
      {/* Tabs bar placeholder */}
      <div className="mb-6 grid gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="rounded-md px-3 py-3">
            <div className="h-3 w-20 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-2 w-28 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>

      {/* Header placeholder */}
      <div className="mb-6 h-7 w-48 rounded bg-slate-200 dark:bg-slate-700" />

      {/* Content card placeholders */}
      <div className="grid gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="h-3 w-24 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-4 h-8 w-16 rounded bg-slate-200 dark:bg-slate-700" />
            <div className="mt-2 h-3 w-32 rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ))}
      </div>
    </div>
  );
}
