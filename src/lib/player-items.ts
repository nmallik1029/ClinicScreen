import type { Doctor, Media, PlaylistItem } from "@prisma/client";
import { toDoctorCardData } from "@/lib/screen-content";
import type { DoctorCardData } from "@/components/DoctorCard";

// Shape consumed by the <Player> component (real player + in-app previews).
// A "BLACK" item is a synthetic gap — dead air the editor inserted between clips.
// A "DOCTOR" item is a doctor card that shows for `duration` seconds.
export type PlayerItem = {
  id: string;
  title: string;
  type: "VIDEO" | "IMAGE" | "BLACK" | "DOCTOR";
  url: string;
  duration: number;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  doctor?: DoctorCardData | null;
};

type PlaylistItemFull = PlaylistItem & { media: Media | null; doctor: Doctor | null };

/** Default seconds an image is shown when neither the item nor media sets one. */
export const DEFAULT_ITEM_SECONDS = 10;
/** Default seconds a doctor card shows. */
export const DEFAULT_DOCTOR_ITEM_SECONDS = 12;

function itemTiming(it: PlaylistItemFull & { media: Media }) {
  const fallback = it.durationOverrideSeconds ?? DEFAULT_ITEM_SECONDS;
  if (it.media.type !== "VIDEO") return { duration: fallback, start: 0, end: null };

  const sourceDuration = it.media.durationSeconds ?? fallback;
  const start = Math.max(0, it.trimStartSeconds ?? 0);
  const end = Math.max(start + 1, it.trimEndSeconds ?? sourceDuration);
  return { duration: Math.max(1, end - start), start, end: it.trimEndSeconds };
}

/** Map ordered playlist items into <Player> items, expanding any leading gap into
 * a preceding black segment so the TV shows real dead air. Handles both media
 * clips and doctor cards; orphan rows (missing media/doctor) are skipped. */
export function toPlayerItems(items: PlaylistItemFull[]): PlayerItem[] {
  const out: PlayerItem[] = [];
  for (const it of items) {
    const isDoctor = it.kind === "DOCTOR";
    if (isDoctor ? !it.doctor : !it.media) continue;

    const gap = Math.max(0, it.leadingGapSeconds ?? 0);
    if (gap > 0) {
      out.push({
        id: `gap-${it.id}`,
        title: "",
        type: "BLACK",
        url: "",
        duration: gap,
        trimStartSeconds: 0,
        trimEndSeconds: null,
      });
    }

    if (isDoctor && it.doctor) {
      out.push({
        id: it.id,
        title: it.doctor.name,
        type: "DOCTOR",
        url: "",
        duration: it.durationOverrideSeconds ?? DEFAULT_DOCTOR_ITEM_SECONDS,
        trimStartSeconds: 0,
        trimEndSeconds: null,
        doctor: toDoctorCardData(it.doctor),
      });
      continue;
    }

    if (!it.media) continue;
    const timing = itemTiming({ ...it, media: it.media });
    out.push({
      id: it.id,
      title: it.media.title,
      type: it.media.type as "VIDEO" | "IMAGE",
      url: it.media.url,
      duration: timing.duration,
      trimStartSeconds: timing.start,
      trimEndSeconds: timing.end,
    });
  }
  return out;
}
