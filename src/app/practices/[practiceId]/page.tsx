import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, Tabs } from "@/components/ui";
import { requirePracticeAccess } from "@/lib/auth";
import { deviceStatus } from "@/lib/status";
import Greeting from "./Greeting";

export default async function OverviewPage({ params }: { params: { practiceId: string } }) {
  const user = await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({
    where: { id: params.practiceId },
    include: {
      _count: { select: { devices: true, locations: true, media: true, playlists: true } },
    },
  });
  if (!practice) notFound();

  const [devices, playlists, media] = await Promise.all([
    prisma.device.findMany({
      where: { practiceId: practice.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        lastSeenAt: true,
        roomType: true,
        assignedPlaylistId: true,
        location: { select: { name: true } },
        assignedPlaylist: { select: { name: true } },
      },
    }),
    prisma.playlist.findMany({
      where: { practiceId: practice.id },
      include: { _count: { select: { items: true, devices: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.media.findMany({
      where: { practiceId: practice.id },
      select: { type: true },
    }),
  ]);

  const onlineCount = devices.filter((d) => deviceStatus(d.lastSeenAt) === "ONLINE").length;
  const assignedScreens = devices.filter((d) => d.assignedPlaylistId).length;
  const unassignedScreens = practice._count.devices - assignedScreens;
  const readyPlaylists = playlists.filter((p) => p._count.items > 0).length;
  const imageCount = media.filter((m) => m.type === "IMAGE").length;
  const videoCount = media.filter((m) => m.type === "VIDEO").length;
  const displayName = user.preferredName ?? user.name;

  const metrics = {
    Overview: { value: `${onlineCount}/${practice._count.devices}`, note: "screens online" },
    Screens: { value: practice._count.devices, note: `${unassignedScreens} need playlists` },
    Locations: { value: practice._count.locations },
    Media: { value: practice._count.media, note: `${videoCount} video, ${imageCount} image` },
    Playlists: { value: practice._count.playlists, note: `${readyPlaylists} ready` },
  };

  const health = [
    { label: "Online screens", value: onlineCount, detail: `${practice._count.devices} total screens` },
    { label: "Assigned screens", value: assignedScreens, detail: `${unassignedScreens} without playlists` },
    { label: "Ready playlists", value: readyPlaylists, detail: `${practice._count.playlists} total playlists` },
  ];

  const actions = [
    {
      label: "Pair a screen",
      href: "screens",
      detail: "Connect a player device and assign its room.",
    },
    {
      label: "Upload media",
      href: "media",
      detail: "Add the videos or images patients should see.",
    },
    {
      label: "Build a playlist",
      href: "playlists",
      detail: "Arrange content into a loop for each screen.",
    },
  ];

  return (
    <div className="practice-page">
      <Tabs practiceId={practice.id} active="Overview" metrics={metrics} />

      <div className="mb-6 flex flex-col gap-4 rounded-lg border border-slate-200 bg-white p-5 shadow-sm md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-medium text-blue-700">{practice.specialty ?? "General practice"}</p>
          <Greeting name={displayName} className="mt-1 text-2xl font-semibold" />
          <p className="mt-1 text-sm text-slate-500">
            {practice.name} is showing {practice._count.media} media item
            {practice._count.media === 1 ? "" : "s"} across {practice._count.playlists} playlist
            {practice._count.playlists === 1 ? "" : "s"}.
          </p>
        </div>
        <Link
          href={`/practices/${practice.id}/screens`}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          Manage screens
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {health.map((item) => (
          <Card key={item.label} className="soft-enter">
            <p className="text-sm font-medium text-slate-500">{item.label}</p>
            <p className="mt-3 text-3xl font-semibold">{item.value}</p>
            <p className="mt-1 text-sm text-slate-500">{item.detail}</p>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <Card className="soft-enter soft-enter-delay-1 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-medium">Recent screen activity</h2>
            <Link href={`/practices/${practice.id}/screens`} className="text-sm text-blue-700 hover:underline">
              View all
            </Link>
          </div>
          {devices.length === 0 ? (
            <p className="text-sm text-slate-500">No screens yet. Pair your first player to start showing content.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {devices.slice(0, 5).map((device) => {
                const status = deviceStatus(device.lastSeenAt);
                return (
                  <li key={device.id} className="flex items-center justify-between gap-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{device.name}</p>
                      <p className="text-xs text-slate-500">
                        {device.location?.name ?? "No location"} - {device.roomType ?? "No room type"} -{" "}
                        {device.assignedPlaylist?.name ?? "No playlist"}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-full px-2 py-1 text-xs font-medium ${
                        status === "ONLINE"
                          ? "bg-green-100 text-green-700"
                          : "bg-slate-100 text-slate-600"
                      }`}
                    >
                      {status.toLowerCase()}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>

        <Card className="soft-enter soft-enter-delay-2">
          <h2 className="mb-4 font-medium">Next useful actions</h2>
          <div className="space-y-3">
            {actions.map((action) => (
              <Link
                key={action.label}
                href={`/practices/${practice.id}/${action.href}`}
                className="block rounded-md border border-slate-200 p-3 transition hover:border-blue-200 hover:bg-blue-50"
              >
                <span className="block text-sm font-medium">{action.label}</span>
                <span className="mt-1 block text-xs text-slate-500">{action.detail}</span>
              </Link>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
