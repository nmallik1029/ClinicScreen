import { prisma } from "@/lib/prisma";
import Player from "./Player";
import DeviceAgent from "./DeviceAgent";
import Repair from "./Repair";
import FullscreenBody from "@/components/FullscreenBody";
import { toPlayerItems } from "@/lib/player-items";

export default async function PlayerPage({
  params,
  searchParams,
}: {
  params: { deviceId: string };
  searchParams: { t?: string };
}) {
  const device = await prisma.device.findUnique({
    where: { id: params.deviceId },
    include: {
      assignedPlaylist: {
        include: { items: { orderBy: { position: "asc" }, include: { media: true, doctor: true } } },
      },
    },
  });

  if (!device) {
    // The screen was deleted (or the id is stale). Drop the saved identity and
    // re-enroll so the TV shows a fresh pairing code instead of dead-ending.
    return (
      <Screen>
        <Repair />
        <p className="text-2xl font-medium">This screen was removed</p>
        <p className="mt-2 text-slate-400">Restarting setup…</p>
      </Screen>
    );
  }

  if (!device.token || device.token !== searchParams.t) {
    return (
      <Screen>
        <Repair />
        <p className="text-2xl font-medium">Screen not paired</p>
        <p className="mt-2 text-slate-400">Restarting setup…</p>
      </Screen>
    );
  }

  const items = device.assignedPlaylist?.items ?? [];

  if (items.length === 0) {
    const playlist = device.assignedPlaylist;
    return (
      <Screen>
        <DeviceAgent deviceId={device.id} token={device.token} />
        {playlist ? (
          <>
            <p className="text-2xl font-medium">“{playlist.name}” is empty</p>
            <p className="mt-2 text-slate-400">Add media to this playlist to start playing.</p>
          </>
        ) : (
          <>
            <p className="text-2xl font-medium">No playlist assigned</p>
            <p className="mt-2 text-slate-400">{device.name}</p>
          </>
        )}
      </Screen>
    );
  }

  const playerItems = toPlayerItems(items);

  return (
    <>
      <FullscreenBody />
      <DeviceAgent deviceId={device.id} token={device.token} />
      <Player items={playerItems} />
    </>
  );
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-center text-white">
      <FullscreenBody />
      {children}
    </div>
  );
}
