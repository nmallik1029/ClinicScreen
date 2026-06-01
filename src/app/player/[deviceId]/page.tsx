import { prisma } from "@/lib/prisma";
import Player from "./Player";

export default async function PlayerPage({ params }: { params: { deviceId: string } }) {
  const device = await prisma.device.findUnique({
    where: { id: params.deviceId },
    include: {
      assignedPlaylist: {
        include: { items: { orderBy: { position: "asc" }, include: { media: true } } },
      },
    },
  });

  if (!device) {
    return (
      <Screen>
        <p className="text-2xl">Screen not found</p>
      </Screen>
    );
  }

  const items = device.assignedPlaylist?.items ?? [];

  if (items.length === 0) {
    return (
      <Screen>
        <p className="text-2xl font-medium">No playlist assigned</p>
        <p className="mt-2 text-slate-400">{device.name}</p>
      </Screen>
    );
  }

  const playerItems = items.map((it) => ({
    id: it.id,
    title: it.media.title,
    type: it.media.type,
    url: it.media.url,
    duration: it.durationOverrideSeconds ?? it.media.durationSeconds ?? 10,
  }));

  return <Player screenName={device.name} items={playerItems} />;
}

function Screen({ children }: { children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 flex flex-col items-center justify-center bg-black text-center text-white">
      {children}
    </div>
  );
}
