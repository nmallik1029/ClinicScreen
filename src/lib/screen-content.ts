import { prisma } from "@/lib/prisma";
import type { DoctorCardData } from "@/components/DoctorCard";

// One clip on a screen's content loop, as the editor needs it. Kept serializable
// so it can be returned from server actions and held in client state. Client code
// should import this with `import type` so prisma never enters the client bundle.
export type EditorItem = {
  itemId: string;
  /** MEDIA = an uploaded image/video; DOCTOR = a doctor card. */
  kind: "MEDIA" | "DOCTOR";
  mediaId: string | null;
  title: string;
  /** Media type; meaningless for doctor cards (kept as "IMAGE" so timing matches). */
  type: "VIDEO" | "IMAGE";
  url: string;
  /** Seconds the clip is shown (images/doctor cards). Videos play their natural length. */
  duration: number;
  /** Original media length when known; used to restore dragged trims. Null for doctor cards. */
  sourceDuration: number | null;
  trimStartSeconds: number;
  trimEndSeconds: number | null;
  /** Black "dead air" seconds before this clip (an intentional gap / island). */
  leadingGapSeconds: number;
  /** Populated only for kind === "DOCTOR". */
  doctor: DoctorCardData | null;
};

/** A media-library entry shown in the editor's media panel. */
export type LibraryMedia = {
  id: string;
  title: string;
  type: "VIDEO" | "IMAGE";
  url: string;
  durationSeconds: number | null;
};

/** A practice doctor as the editor's doctor panel needs it. */
export type EditorDoctor = DoctorCardData & { id: string };

/** Default seconds an image shows when nothing else is set. */
export const DEFAULT_IMAGE_SECONDS = 10;
/** Default seconds a doctor card shows on the timeline. */
export const DEFAULT_DOCTOR_SECONDS = 12;

function effectiveDuration(it: {
  media: { durationSeconds: number | null; type: string };
  durationOverrideSeconds: number | null;
  trimStartSeconds: number | null;
  trimEndSeconds: number | null;
}) {
  const fallback = it.durationOverrideSeconds ?? DEFAULT_IMAGE_SECONDS;
  const sourceDuration = it.media.durationSeconds ?? fallback;
  if (it.media.type !== "VIDEO") return { duration: fallback, sourceDuration: it.media.durationSeconds };

  const start = Math.max(0, it.trimStartSeconds ?? 0);
  const end = Math.max(start + 1, it.trimEndSeconds ?? sourceDuration);
  return {
    duration: Math.max(1, end - start),
    sourceDuration,
  };
}

/** Load a screen loop's ordered clips for the editor. */
export async function loadScreenItems(playlistId: string): Promise<EditorItem[]> {
  const items = await prisma.playlistItem.findMany({
    where: { playlistId },
    orderBy: { position: "asc" },
    include: { media: true, doctor: true },
  });
  return items.flatMap((it): EditorItem[] => {
    const leadingGapSeconds = Math.max(0, it.leadingGapSeconds ?? 0);

    if (it.kind === "DOCTOR") {
      if (!it.doctor) return []; // doctor was deleted — drop the orphan slot
      return [
        {
          itemId: it.id,
          kind: "DOCTOR",
          mediaId: null,
          title: it.doctor.name,
          type: "IMAGE",
          url: "",
          duration: it.durationOverrideSeconds ?? DEFAULT_DOCTOR_SECONDS,
          sourceDuration: null,
          trimStartSeconds: 0,
          trimEndSeconds: null,
          leadingGapSeconds,
          doctor: toDoctorCardData(it.doctor),
        },
      ];
    }

    if (!it.media) return []; // media-kind row with no media — skip
    const timing = effectiveDuration({ ...it, media: it.media });
    return [
      {
        itemId: it.id,
        kind: "MEDIA",
        mediaId: it.mediaId,
        title: it.media.title,
        type: it.media.type as "VIDEO" | "IMAGE",
        url: it.media.url,
        duration: timing.duration,
        sourceDuration: timing.sourceDuration,
        trimStartSeconds: it.trimStartSeconds ?? 0,
        trimEndSeconds: it.trimEndSeconds,
        leadingGapSeconds,
        doctor: null,
      },
    ];
  });
}

/** Map a Doctor row to the card's display shape. */
export function toDoctorCardData(d: {
  name: string;
  credentials: string | null;
  title: string | null;
  specialty: string | null;
  photoUrl: string | null;
  bio: string | null;
  screenBlurb: string | null;
}): DoctorCardData {
  return {
    name: d.name,
    credentials: d.credentials,
    title: d.title,
    specialty: d.specialty,
    photoUrl: d.photoUrl,
    bio: d.bio,
    screenBlurb: d.screenBlurb,
  };
}
