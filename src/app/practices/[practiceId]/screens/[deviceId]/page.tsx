import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Input, Label, Button, StatusBadge } from "@/components/ui";
import {
  updateScreenInfo,
  createRefreshCommand,
  resetDeviceToken,
  deleteScreen,
} from "../../actions";
import { requirePracticeAccess } from "@/lib/auth";
import { deviceStatus } from "@/lib/status";
import { toPlayerItems } from "@/lib/player-items";
import DeleteButton from "@/components/DeleteButton";
import ScreenLocationField from "@/components/ScreenLocationField";
import Player from "@/app/player/[deviceId]/Player";

export default async function ScreenDetailPage({
  params,
}: {
  params: { practiceId: string; deviceId: string };
}) {
  await requirePracticeAccess(params.practiceId);

  // Independent queries — run them together instead of serially.
  const [device, locations] = await Promise.all([
    prisma.device.findUnique({
      where: { id: params.deviceId },
      include: {
        location: true,
        assignedPlaylist: {
          include: { items: { orderBy: { position: "asc" }, include: { media: true, doctor: true } } },
        },
      },
    }),
    prisma.location.findMany({
      where: { practiceId: params.practiceId },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!device || device.practiceId !== params.practiceId) notFound();

  const items = device.assignedPlaylist?.items ?? [];
  const playerItems = toPlayerItems(items);
  const status = deviceStatus(device.lastSeenAt);
  const editHref = `/practices/${params.practiceId}/screens/${device.id}/edit`;

  // Delete from the detail page, then return to the grid (the device is gone).
  async function removeScreen() {
    "use server";
    await deleteScreen(params.practiceId, params.deviceId);
    redirect(`/practices/${params.practiceId}/screens`);
  }

  return (
    <div className="practice-page mx-auto max-w-6xl">
      <Link
        href={`/practices/${params.practiceId}/screens`}
        className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        ← Back to screens
      </Link>

      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">{device.name}</h1>
            <StatusBadge status={status} />
          </div>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            {[device.location?.name, device.roomType].filter(Boolean).join(" · ") || "No location set"}
            {device.lastSeenAt ? ` · last seen ${device.lastSeenAt.toLocaleString()}` : " · never seen"}
          </p>
        </div>
      </div>

      {/* Settings on the left, big live preview on the right. */}
      <div className="mt-5 grid gap-6 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left: settings + maintenance */}
        <div className="space-y-6">
          <Card>
            <h2 className="mb-3 font-medium">Screen settings</h2>
            <form
              action={updateScreenInfo.bind(null, params.practiceId, device.id)}
              className="space-y-3"
            >
              <div>
                <Label>Name</Label>
                <Input name="name" defaultValue={device.name} />
              </div>
              <div>
                <Label>Room type</Label>
                <Input name="roomType" defaultValue={device.roomType ?? ""} placeholder="e.g. Waiting Room" />
              </div>
              <Button type="submit" variant="ghost">
                Save changes
              </Button>
            </form>
            <div className="mt-3">
              <ScreenLocationField
                practiceId={params.practiceId}
                deviceId={device.id}
                locations={locations.map((l) => ({ id: l.id, name: l.name }))}
                currentLocationId={device.locationId}
              />
            </div>
          </Card>

          <div className="flex flex-wrap items-center gap-4 border-t border-slate-200 pt-4 dark:border-slate-800">
            <form action={resetDeviceToken.bind(null, params.practiceId, device.id)}>
              <button
                type="submit"
                className="text-xs text-slate-400 hover:text-slate-700 dark:hover:text-slate-200"
                title="Invalidate the current player link and generate a new one"
              >
                Reset player link
              </button>
            </form>
            <DeleteButton action={removeScreen} confirmText={`Delete screen "${device.name}"?`} />
          </div>
        </div>

        {/* Right: actions + preview */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <Link
              href={editHref}
              className="inline-flex items-center justify-center rounded-md bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700"
            >
              + Add content
            </Link>

            <form action={createRefreshCommand.bind(null, params.practiceId, device.id)}>
              <Button type="submit" variant="ghost">
                Refresh screen
              </Button>
            </form>

            {device.token ? (
              <Link
                href={`/player/${device.id}?t=${encodeURIComponent(device.token)}`}
                target="_blank"
                className="text-sm text-blue-700 dark:text-blue-400"
              >
                Open player ↗
              </Link>
            ) : null}
          </div>

          {/* Live preview — the element the screen card morphs into. */}
          <div
            className="relative aspect-video w-full overflow-hidden rounded-2xl bg-black ring-1 ring-black/20"
            style={{ viewTransitionName: `screen-stage-${device.id}` }}
          >
            {playerItems.length > 0 ? (
              <Player items={playerItems} contained />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center text-slate-400">
                <p className="text-lg font-medium">No content yet</p>
                <p className="text-sm text-slate-500">Add content to start playing on this screen.</p>
              </div>
            )}
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Live preview{playerItems.length > 0 ? ` · ${playerItems.length} item${playerItems.length === 1 ? "" : "s"} in the loop` : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
