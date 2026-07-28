"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  backfillDoctorBlurbs,
  deleteDoctor,
  rescanDoctorPage,
  saveDoctors,
} from "@/app/practices/[practiceId]/doctors/actions";

export type DoctorRow = {
  id: string;
  name: string;
  credentials: string | null;
  title: string | null;
  specialty: string | null;
  photoUrl: string | null;
  sourceUrl: string;
  scrapedAt: string;
};

function scrapedLabel(iso: string) {
  const d = new Date(iso);
  return `Imported ${d.toLocaleDateString()}`;
}

export default function DoctorList({
  practiceId,
  doctors,
  missingBlurbCount = 0,
}: {
  practiceId: string;
  doctors: DoctorRow[];
  /** How many imported doctors still have no rephrased screen intro. */
  missingBlurbCount?: number;
}) {
  const router = useRouter();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [backfilling, setBackfilling] = useState(false);
  const [, startTransition] = useTransition();

  async function onBackfill() {
    setBackfilling(true);
    setError(null);
    try {
      const res = await backfillDoctorBlurbs(practiceId);
      if (!res.ok) setError(res.error);
      else router.refresh();
    } finally {
      setBackfilling(false);
    }
  }

  if (doctors.length === 0) {
    return (
      <p className="text-sm text-slate-500">
        No doctors yet. Import them from your practice&apos;s website to show them on a screen.
      </p>
    );
  }

  async function onRescan(row: DoctorRow) {
    setBusyId(row.id);
    setError(null);
    try {
      const res = await rescanDoctorPage(practiceId, row.sourceUrl);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      const saved = await saveDoctors(practiceId, res.doctors);
      if (!saved.ok) setError(saved.error);
      else router.refresh();
    } finally {
      setBusyId(null);
    }
  }

  function onDelete(row: DoctorRow) {
    setBusyId(row.id);
    startTransition(async () => {
      await deleteDoctor(practiceId, row.id);
      setBusyId(null);
      router.refresh();
    });
  }

  return (
    <div>
      {error && <p className="mb-2 text-xs text-red-600">{error}</p>}
      <div className="mb-3 flex items-center justify-between gap-3 rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-xs dark:border-blue-900/60 dark:bg-blue-950/30">
        <span className="text-slate-600 dark:text-slate-300">
          {missingBlurbCount > 0
            ? `${missingBlurbCount} ${missingBlurbCount === 1 ? "doctor needs" : "doctors need"} a screen intro written.`
            : "Rewrite every doctor's screen intro."}
        </span>
        <button
          type="button"
          onClick={onBackfill}
          disabled={backfilling}
          className="shrink-0 rounded-md bg-blue-600 px-2.5 py-1 font-medium text-white hover:bg-blue-500 disabled:opacity-50"
        >
          {backfilling ? "Writing…" : missingBlurbCount > 0 ? "Generate intros" : "Regenerate intros"}
        </button>
      </div>
      <ul className="divide-y dark:divide-slate-800">
        {doctors.map((d) => (
          <li key={d.id} className="flex items-center gap-3 py-3">
            <span className="h-14 w-14 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
              {d.photoUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate font-medium">
                {d.name}
                {d.credentials ? `, ${d.credentials}` : ""}
              </p>
              <p className="truncate text-xs text-slate-500">{d.specialty ?? d.title ?? "—"}</p>
              <p className="truncate text-[11px] text-slate-400">{scrapedLabel(d.scrapedAt)}</p>
            </div>
            <div className="flex shrink-0 gap-1">
              <a
                href={d.sourceUrl}
                target="_blank"
                rel="noreferrer noopener"
                className="rounded-md px-2 py-1 text-xs text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                title="Open the source page"
              >
                Source ↗
              </a>
              <button
                type="button"
                onClick={() => onRescan(d)}
                disabled={busyId === d.id}
                className="rounded-md px-2 py-1 text-xs text-slate-600 hover:bg-slate-100 disabled:opacity-50 dark:text-slate-300 dark:hover:bg-slate-800"
                title="Pull the latest details from their website"
              >
                {busyId === d.id ? "Working…" : "Re-scan"}
              </button>
              <button
                type="button"
                onClick={() => onDelete(d)}
                disabled={busyId === d.id}
                className="rounded-md px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/40"
              >
                Delete
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
