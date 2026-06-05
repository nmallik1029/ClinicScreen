import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Tabs, Input, Select, Label, Button, StatusBadge } from "@/components/ui";
import { createScreen, updateScreen, createRefreshCommand, resetDeviceToken, deleteScreen } from "../actions";
import { requirePracticeAccess } from "@/lib/auth";
import { deviceStatus } from "@/lib/status";
import DeleteButton from "@/components/DeleteButton";
import { expireStalePending, RECENT_COMMAND_MS } from "@/lib/commands";
import AddScreenByCode from "./AddScreenByCode";

export default async function ScreensPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({ where: { id: params.practiceId } });
  if (!practice) notFound();

  await expireStalePending({ practiceId: practice.id });

  const [devices, locations, playlists] = await Promise.all([
    prisma.device.findMany({
      where: { practiceId: practice.id },
      orderBy: { name: "asc" },
      include: {
        location: true,
        assignedPlaylist: true,
        commands: {
          where: { createdAt: { gte: new Date(Date.now() - RECENT_COMMAND_MS) } },
          orderBy: { createdAt: "desc" },
          take: 3,
        },
      },
    }),
    prisma.location.findMany({ where: { practiceId: practice.id }, orderBy: { name: "asc" } }),
    prisma.playlist.findMany({ where: { practiceId: practice.id }, orderBy: { name: "asc" } }),
  ]);
  const onlineCount = devices.filter((d) => deviceStatus(d.lastSeenAt) === "ONLINE").length;
  const unassignedCount = devices.filter((d) => !d.assignedPlaylistId).length;
  const metrics = {
    Overview: { value: `${onlineCount}/${devices.length}`, note: "screens online" },
    Screens: { value: devices.length, note: `${unassignedCount} need playlists` },
    Locations: { value: locations.length },
    Playlists: { value: playlists.length },
  };

  return (
    <div className="practice-page">
      <PageHeader title={practice.name} subtitle="Screens" />
      <Tabs practiceId={practice.id} active="Screens" metrics={metrics} />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          {devices.length === 0 && (
            <Card>
              <p className="text-sm text-slate-500">No screens yet.</p>
            </Card>
          )}
          {devices.map((d) => (
            <Card key={d.id}>
              <div className="mb-3 flex items-center justify-between">
                <div>
                  <p className="font-medium">{d.name}</p>
                  <p className="text-xs text-slate-500">
                    {d.location?.name ?? "No location"} · {d.roomType ?? "No room type"}
                    {d.lastSeenAt ? ` · last seen ${d.lastSeenAt.toLocaleString()}` : " · never seen"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusBadge status={deviceStatus(d.lastSeenAt)} />
                  <form action={createRefreshCommand.bind(null, practice.id, d.id)}>
                    <Button type="submit" variant="ghost">
                      Refresh screen
                    </Button>
                  </form>
                  {d.token ? (
                    <Link
                      href={`/player/${d.id}?t=${encodeURIComponent(d.token)}`}
                      target="_blank"
                      className="text-xs text-blue-700"
                    >
                      Open player ↗
                    </Link>
                  ) : null}
                  <form action={resetDeviceToken.bind(null, practice.id, d.id)}>
                    <button
                      type="submit"
                      className="text-xs text-slate-400 hover:text-slate-700"
                      title="Invalidate the current player link and generate a new one"
                    >
                      Reset link
                    </button>
                  </form>
                  <DeleteButton
                    action={deleteScreen.bind(null, practice.id, d.id)}
                    confirmText={`Delete screen "${d.name}"?`}
                  />
                </div>
              </div>

              {d.commands.length > 0 && (
                <ul className="mb-3 space-y-0.5 text-xs text-slate-500">
                  {d.commands.map((c) => (
                    <li key={c.id}>
                      {c.commandType} · {c.status} · sent {c.createdAt.toLocaleTimeString()}
                      {c.completedAt ? ` · done ${c.completedAt.toLocaleTimeString()}` : ""}
                    </li>
                  ))}
                </ul>
              )}

              <form action={updateScreen.bind(null, practice.id, d.id)} className="grid gap-2 sm:grid-cols-4">
                <div>
                  <Label>Name</Label>
                  <Input name="name" defaultValue={d.name} />
                </div>
                <div>
                  <Label>Room type</Label>
                  <Input name="roomType" defaultValue={d.roomType ?? ""} placeholder="e.g. Waiting Room" />
                </div>
                <div>
                  <Label>Location</Label>
                  <Select name="locationId" defaultValue={d.locationId ?? ""}>
                    <option value="">None</option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div>
                  <Label>Playlist</Label>
                  <Select name="assignedPlaylistId" defaultValue={d.assignedPlaylistId ?? ""}>
                    <option value="">None</option>
                    {playlists.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="sm:col-span-4">
                  <Button type="submit" variant="ghost">
                    Save changes
                  </Button>
                </div>
              </form>
            </Card>
          ))}
        </div>

        <div className="space-y-4">
        <Card>
          <h2 className="mb-1 font-medium">Pair a screen</h2>
          <p className="mb-3 text-xs text-slate-500">
            Set up a TV: open the ClinicScreen Player app on its PC and enter the code it shows.
          </p>
          <AddScreenByCode
            practiceId={practice.id}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          />
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">Add screen manually</h2>
          <p className="mb-3 text-xs text-slate-500">
            Creates a screen + player link without a device present.
          </p>
          <form action={createScreen.bind(null, practice.id)} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Waiting Room" required />
            </div>
            <div>
              <Label>Room type (optional)</Label>
              <Input name="roomType" placeholder="e.g. Exam Room" />
            </div>
            <div>
              <Label>Location (optional)</Label>
              <Select name="locationId" defaultValue="">
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Add screen</Button>
          </form>
        </Card>
        </div>
      </div>
    </div>
  );
}
