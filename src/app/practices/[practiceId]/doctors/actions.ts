"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requirePracticeAccess } from "@/lib/auth";
import { saveMediaFile, deleteUploadedFile } from "@/lib/upload";
import {
  scrapePracticeSite,
  rescrapeDoctor,
  generateScreenBlurb,
  type ScrapedDoctor,
} from "@/lib/doctor-scrape";

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;

export type ScanResult =
  | { ok: true; doctors: ScrapedDoctor[]; failures: { url: string; error: string }[] }
  | { ok: false; error: string };

function normalizeSiteUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    const u = new URL(withScheme);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : null;
  } catch {
    return null;
  }
}

/**
 * Read-only pass over a practice's website. Nothing is saved — the admin reviews
 * what came back and confirms, which is what keeps a cheap extraction model safe.
 */
export async function scanPracticeWebsite(practiceId: string, siteUrl: string): Promise<ScanResult> {
  await requirePracticeAccess(practiceId);
  const url = normalizeSiteUrl(siteUrl);
  if (!url) return { ok: false, error: "Enter a valid website address, e.g. example.com" };

  try {
    const { doctors, failures } = await scrapePracticeSite(url);
    if (doctors.length === 0) {
      return {
        ok: false,
        error: "No physician pages were found on that site. Try linking directly to the doctors page.",
      };
    }
    return { ok: true, doctors, failures };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read that website." };
  }
}

/** Re-scrape a single already-saved doctor's source page. */
export async function rescanDoctorPage(practiceId: string, sourceUrl: string): Promise<ScanResult> {
  await requirePracticeAccess(practiceId);
  try {
    const doctor = await rescrapeDoctor(sourceUrl);
    if (!doctor) return { ok: false, error: "That page no longer looks like a physician profile." };
    return { ok: true, doctors: [doctor], failures: [] };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not read that page." };
  }
}

/**
 * Copy the headshot into our own storage. Screens must not hotlink the practice's
 * site — it would break on their next redesign and leak traffic to them.
 */
async function storePhoto(practiceId: string, photoUrl: string): Promise<string | null> {
  try {
    const res = await fetch(photoUrl, { signal: AbortSignal.timeout(20_000) });
    if (!res.ok) return null;
    const contentType = (res.headers.get("content-type") ?? "").toLowerCase();
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("jpeg") || contentType.includes("jpg")
          ? "jpg"
          : null;
    if (!ext) return null;

    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_PHOTO_BYTES) return null;

    const file = new File([bytes], `doctor.${ext}`, { type: contentType });
    const saved = await saveMediaFile(practiceId, file);
    return saved.ok ? saved.url : null;
  } catch {
    return null; // a missing headshot shouldn't fail the import
  }
}

/**
 * Persist the doctors the admin confirmed. Keyed on sourceUrl so re-importing a
 * site updates the existing rows in place instead of duplicating them.
 */
export async function saveDoctors(
  practiceId: string,
  doctors: ScrapedDoctor[],
): Promise<{ ok: true; saved: number } | { ok: false; error: string }> {
  await requirePracticeAccess(practiceId);
  if (doctors.length === 0) return { ok: false, error: "Select at least one doctor to import." };

  let saved = 0;
  for (const d of doctors) {
    const existing = await prisma.doctor.findUnique({
      where: { practiceId_sourceUrl: { practiceId, sourceUrl: d.sourceUrl } },
    });

    // Only re-download when the source image actually changed.
    let photoUrl = existing?.photoUrl ?? null;
    if (d.photoUrl && d.photoUrl !== existing?.sourcePhotoUrl) {
      const stored = await storePhoto(practiceId, d.photoUrl);
      if (stored) {
        if (existing?.photoUrl) await deleteUploadedFile(existing.photoUrl);
        photoUrl = stored;
      }
    }

    // Rephrase into a screen-ready blurb once, at import. Reuse the existing blurb
    // when the source bio hasn't changed, so re-imports don't pay for it again.
    const bioUnchanged = existing && existing.bio === d.bio && Boolean(existing.screenBlurb);
    const screenBlurb = bioUnchanged
      ? existing!.screenBlurb
      : await generateScreenBlurb({
          name: d.name,
          credentials: d.credentials,
          title: d.title,
          specialty: d.specialty,
          bio: d.bio,
          education: d.education,
          boardCertifications: d.boardCertifications,
          languages: d.languages,
        });

    const data = {
      name: d.name,
      credentials: d.credentials,
      title: d.title,
      specialty: d.specialty,
      bio: d.bio,
      screenBlurb,
      education: d.education,
      boardCertifications: d.boardCertifications,
      languages: d.languages,
      acceptingNewPatients: d.acceptingNewPatients,
      photoUrl,
      sourcePhotoUrl: d.photoUrl,
      scrapedAt: new Date(),
    };

    await prisma.doctor.upsert({
      where: { practiceId_sourceUrl: { practiceId, sourceUrl: d.sourceUrl } },
      create: { practiceId, sourceUrl: d.sourceUrl, ...data },
      update: data,
    });
    saved++;
  }

  revalidatePath(`/practices/${practiceId}/doctors`);
  return { ok: true, saved };
}

/**
 * (Re)generate the screen blurb for every doctor in a practice, overwriting any
 * existing blurb. Used to fill in doctors imported before blurbs existed and to
 * refresh them after the blurb style/length changes. Returns how many were written.
 */
export async function backfillDoctorBlurbs(
  practiceId: string,
): Promise<{ ok: true; filled: number } | { ok: false; error: string }> {
  await requirePracticeAccess(practiceId);
  const doctors = await prisma.doctor.findMany({ where: { practiceId } });
  let filled = 0;
  for (const d of doctors) {
    const blurb = await generateScreenBlurb({
      name: d.name,
      credentials: d.credentials,
      title: d.title,
      specialty: d.specialty,
      bio: d.bio,
      education: d.education,
      boardCertifications: d.boardCertifications,
      languages: d.languages,
    });
    if (!blurb) continue;
    await prisma.doctor.update({ where: { id: d.id }, data: { screenBlurb: blurb } });
    filled++;
  }
  if (filled > 0) revalidatePath(`/practices/${practiceId}/doctors`);
  return { ok: true, filled };
}

export async function deleteDoctor(practiceId: string, doctorId: string) {
  await requirePracticeAccess(practiceId);
  const doctor = await prisma.doctor.findFirst({ where: { id: doctorId, practiceId } });
  if (!doctor) return;
  if (doctor.photoUrl) await deleteUploadedFile(doctor.photoUrl);
  await prisma.doctor.delete({ where: { id: doctor.id } });
  revalidatePath(`/practices/${practiceId}/doctors`);
}
