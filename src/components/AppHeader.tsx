"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export type HeaderUser = {
  name: string;
  roleLabel: string;
  isSuperadmin: boolean;
} | null;

// Everything is managed from the Screens area now (content + locations live in
// each screen's editor/settings), so Screens is the only top-level section.
const SECTIONS = [{ key: "screens", label: "Screens" }];

/**
 * Single seamless top bar: brand on the far left, practice section nav in the
 * middle, user + sign-out on the far right. The section nav is derived from the
 * URL (/practices/<id>/<section>), so it shows only inside a practice and
 * highlights the active section without each page passing props.
 */
export default function AppHeader({ user }: { user: HeaderUser }) {
  const pathname = usePathname() ?? "";
  const isPlayerSurface = pathname === "/enroll" || pathname.startsWith("/player/");
  const parts = pathname.split("/").filter(Boolean);
  const inPractice = parts[0] === "practices" && Boolean(parts[1]);
  const practiceId = inPractice ? parts[1] : null;
  const activeSection = inPractice ? parts[2] ?? "overview" : null;

  // Inside a practice the screen-centric pages carry their own greeting / nav, so
  // the global chrome is hidden there for a cleaner, app-like surface.
  if (isPlayerSurface || inPractice) return null;

  // The brand doubles as "home": back to this practice's overview when inside
  // one, otherwise the app root.
  const homeHref = practiceId ? `/practices/${practiceId}` : "/";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur transition-colors dark:border-slate-800 dark:bg-slate-950/90">
      <div className="flex h-14 w-full items-center gap-6 px-6">
        {/* Far left: brand + (superadmin) */}
        <div className="flex shrink-0 items-center gap-4">
          <Link href={homeHref} className="text-lg font-semibold text-blue-700 dark:text-blue-400">
            ClinicScreen
          </Link>
          {user?.isSuperadmin && (
            <Link
              href="/superadmin"
              className="text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
            >
              Superadmin
            </Link>
          )}
        </div>

        {/* Center: practice section nav */}
        {inPractice && practiceId && (
          <nav className="flex flex-1 items-center justify-center gap-1">
            {SECTIONS.map((s) => {
              const active = activeSection === s.key;
              return (
                <Link
                  key={s.key}
                  href={`/practices/${practiceId}/${s.key}`}
                  prefetch
                  className={`relative rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    active
                      ? "text-blue-700 dark:text-blue-300"
                      : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  }`}
                >
                  {s.label}
                  <span
                    className={`absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600 transition-opacity dark:bg-blue-400 ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                  />
                </Link>
              );
            })}
          </nav>
        )}

        {/* Far right: user + sign out */}
        <div className={`flex shrink-0 items-center gap-3 text-sm ${inPractice ? "" : "ml-auto"}`}>
          {user ? (
            <>
              <span className="text-slate-500 dark:text-slate-400">
                {user.name} · {user.roleLabel}
              </span>
              <form action="/auth/logout" method="post">
                <button className="rounded border border-slate-300 px-3 py-1.5 font-medium text-slate-700 transition-colors hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800">
                  Sign out
                </button>
              </form>
            </>
          ) : (
            <Link
              href="/login"
              className="rounded bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700"
            >
              Sign in
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
