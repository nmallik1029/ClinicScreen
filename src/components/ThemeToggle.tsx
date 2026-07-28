"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { TRASH_STATE_EVENT, type TrashState } from "@/lib/editor-trash";

/**
 * Fixed bottom-right button. Normally the dark-mode toggle; while a timeline clip
 * is being dragged in the content editor it flips into a trash drop-target (the
 * editor drives this via the trash-state event and reads this button's rect to
 * detect the drop), then flips back. Hidden on the player/enroll surfaces.
 */
export default function ThemeToggle() {
  // Start from whatever the no-flash script already set on <html>.
  const [dark, setDark] = useState(false);
  const [trash, setTrash] = useState<TrashState>({ active: false, armed: false });
  const pathname = usePathname() ?? "";
  const isPlayerSurface = pathname === "/enroll" || pathname.startsWith("/player/");

  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    function onTrash(e: Event) {
      const detail = (e as CustomEvent<TrashState>).detail;
      if (detail) setTrash(detail);
    }
    window.addEventListener(TRASH_STATE_EVENT, onTrash);
    return () => window.removeEventListener(TRASH_STATE_EVENT, onTrash);
  }, []);

  function toggle() {
    if (trash.active) return; // acting as a trash drop-target right now
    const next = !document.documentElement.classList.contains("dark");
    document.documentElement.classList.toggle("dark", next);
    try {
      localStorage.setItem("theme", next ? "dark" : "light");
    } catch {
      /* ignore unavailable storage */
    }
    setDark(next);
  }

  if (isPlayerSurface) return null;

  const { active, armed } = trash;

  return (
    <button
      id="cs-corner-fab"
      type="button"
      onClick={toggle}
      aria-label={
        active ? "Drop here to remove from screen" : dark ? "Switch to light mode" : "Switch to dark mode"
      }
      title={active ? "Drop to remove from screen" : dark ? "Switch to light mode" : "Switch to dark mode"}
      className={`fixed bottom-4 right-4 z-50 flex aspect-square h-11 w-11 items-center justify-center rounded-full border shadow-lg ring-1 transition-all duration-300 ${
        active
          ? armed
            ? "scale-110 border-red-300 bg-red-600 text-white ring-red-300/60"
            : "border-fuchsia-300 bg-slate-950 text-white ring-fuchsia-400/40"
          : "border-slate-300 bg-white text-slate-600 ring-black/5 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200 dark:ring-white/10 dark:hover:bg-slate-700"
      }`}
    >
      <span
        className={`relative block h-5 w-5 transition-transform duration-300 ${
          active ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Moon — light mode, idle */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ease-out ${
            active
              ? "scale-0 opacity-0"
              : "rotate-0 scale-100 opacity-100 dark:-rotate-90 dark:scale-0 dark:opacity-0"
          }`}
        >
          <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
        </svg>
        {/* Sun — dark mode, idle */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ease-out ${
            active
              ? "scale-0 opacity-0"
              : "rotate-90 scale-0 opacity-0 dark:rotate-0 dark:scale-100 dark:opacity-100"
          }`}
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
        </svg>
        {/* Trash — while dragging a clip */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`absolute inset-0 h-5 w-5 transition-all duration-300 ease-out ${
            active ? "rotate-0 scale-100 opacity-100" : "rotate-90 scale-0 opacity-0"
          }`}
        >
          <path d="M3 6h18" />
          <path d="M8 6V4h8v2" />
          <path d="M6 6l1 15h10l1-15" />
          <path d="M10 11v6M14 11v6" />
        </svg>
      </span>
    </button>
  );
}
