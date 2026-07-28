"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { scanPracticeWebsite, saveDoctors } from "@/app/practices/[practiceId]/doctors/actions";
import type { ScrapedDoctor } from "@/lib/doctor-scrape";

/**
 * Two-step import: scan the practice's site, then review before saving. The review
 * step is deliberate — it's what lets the scrape run on a small, cheap model
 * without risking a wrong bio reaching a waiting-room screen.
 */
export default function DoctorImport({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const [siteUrl, setSiteUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [found, setFound] = useState<ScrapedDoctor[] | null>(null);
  const [failures, setFailures] = useState<{ url: string; error: string }[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, startSaving] = useTransition();

  async function onScan(e: React.FormEvent) {
    e.preventDefault();
    setScanning(true);
    setError(null);
    setFound(null);
    try {
      const res = await scanPracticeWebsite(practiceId, siteUrl);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFound(res.doctors);
      setFailures(res.failures);
      setSelected(new Set(res.doctors.map((d) => d.sourceUrl))); // default: import all
    } catch {
      setError("The scan failed. Check the address and try again.");
    } finally {
      setScanning(false);
    }
  }

  function toggle(sourceUrl: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(sourceUrl)) next.delete(sourceUrl);
      else next.add(sourceUrl);
      return next;
    });
  }

  function onSave() {
    if (!found) return;
    const chosen = found.filter((d) => selected.has(d.sourceUrl));
    startSaving(async () => {
      const res = await saveDoctors(practiceId, chosen);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setFound(null);
      setSiteUrl("");
      router.refresh();
    });
  }

  return (
    <div className="space-y-3">
      <form onSubmit={onScan} className="space-y-2">
        <input
          type="text"
          value={siteUrl}
          onChange={(e) => setSiteUrl(e.target.value)}
          placeholder="cvmedpc.com"
          disabled={scanning}
          className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900"
        />
        <button
          type="submit"
          disabled={scanning || !siteUrl.trim()}
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {scanning ? "Scanning website…" : "Scan for doctors"}
        </button>
        {scanning && (
          <p className="text-xs text-slate-500">
            Reading the site and pulling each physician&apos;s details. This can take a minute.
          </p>
        )}
      </form>

      {error && <p className="text-xs text-red-600">{error}</p>}

      {found && (
        <div className="space-y-3 border-t border-slate-200 pt-3 dark:border-slate-800">
          <p className="text-xs text-slate-500">
            Found <span className="font-medium text-slate-700 dark:text-slate-300">{found.length}</span>{" "}
            {found.length === 1 ? "doctor" : "doctors"}. Review and uncheck any you don&apos;t want.
          </p>

          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {found.map((d) => (
              <li key={d.sourceUrl}>
                <label className="flex cursor-pointer items-start gap-2 rounded-md p-1.5 hover:bg-slate-50 dark:hover:bg-slate-800">
                  <input
                    type="checkbox"
                    checked={selected.has(d.sourceUrl)}
                    onChange={() => toggle(d.sourceUrl)}
                    className="mt-1.5"
                  />
                  <span className="flex min-w-0 flex-1 items-start gap-2">
                    <span className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
                      {d.photoUrl && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={d.photoUrl} alt="" className="h-full w-full object-cover" />
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-medium">
                        {d.name}
                        {d.credentials ? `, ${d.credentials}` : ""}
                      </span>
                      <span className="block truncate text-[11px] text-slate-500">
                        {d.specialty ?? d.title ?? "—"}
                      </span>
                      {!d.photoUrl && (
                        <span className="block text-[10px] text-amber-600">No photo found</span>
                      )}
                    </span>
                  </span>
                </label>
              </li>
            ))}
          </ul>

          {failures.length > 0 && (
            <p className="text-[11px] text-amber-600">
              {failures.length} page{failures.length === 1 ? "" : "s"} couldn&apos;t be read and were
              skipped.
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={onSave}
              disabled={saving || selected.size === 0}
              className="flex-1 rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? "Importing…" : `Import ${selected.size}`}
            </button>
            <button
              type="button"
              onClick={() => setFound(null)}
              disabled={saving}
              className="rounded-md border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
