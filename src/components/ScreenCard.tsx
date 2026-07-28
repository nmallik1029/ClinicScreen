"use client";

import ZoomLink from "@/components/ZoomLink";
import Player from "@/app/player/[deviceId]/Player";
import type { DisplayStatus } from "@/lib/status";
import type { PlayerItem } from "@/lib/player-items";

export default function ScreenCard({
  practiceId,
  deviceId,
  name,
  locationName,
  roomType,
  status,
  previewItems,
}: {
  practiceId: string;
  deviceId: string;
  name: string;
  locationName: string | null;
  roomType: string | null;
  status: DisplayStatus;
  previewItems: PlayerItem[];
}) {
  const online = status === "ONLINE";
  const place = [locationName, roomType].filter(Boolean).join(" · ") || "No location set";
  const previewKey = previewItems.map((i) => i.id).join("|");

  return (
    <ZoomLink
      href={`/practices/${practiceId}/screens/${deviceId}`}
      prefetch
      className="group block rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-[box-shadow,border-color] hover:border-slate-300 hover:shadow-lg dark:border-slate-800 dark:bg-slate-900 dark:hover:border-slate-700"
    >
      {/* The "TV": live preview, and the shared element that morphs into detail.
          Hover feedback is shadow/border only (no transform) so the rounded clip
          over the video never flickers. */}
      <div
        className="relative aspect-video w-full overflow-hidden rounded-xl bg-slate-950 ring-1 ring-black/20"
        style={{ viewTransitionName: `screen-stage-${deviceId}` }}
      >
        {previewItems.length > 0 ? (
          <Player key={previewKey} items={previewItems} contained />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-xs text-slate-500">
            No content yet
          </div>
        )}

        {/* Status pill — dark scrim so it reads on any preview */}
        <span
          className={`absolute right-2 top-2 z-10 inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur ${
            online ? "bg-green-600/90" : "bg-slate-900/70"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${online ? "bg-green-300" : "bg-slate-400"}`} />
          {online ? "Online" : "Offline"}
        </span>
      </div>

      <div className="mt-3 px-1 pb-1">
        <p className="truncate font-medium">{name}</p>
        <p className="truncate text-xs text-slate-500 dark:text-slate-400">{place}</p>
      </div>
    </ZoomLink>
  );
}
