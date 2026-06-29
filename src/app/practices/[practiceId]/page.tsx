import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePracticeAccess } from "@/lib/auth";
import Greeting from "./Greeting";
import SetupChecklist, { type SetupStep } from "@/components/SetupChecklist";

export default async function OverviewPage({ params }: { params: { practiceId: string } }) {
  const user = await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({
    where: { id: params.practiceId },
    include: { _count: { select: { media: true, playlists: true } } },
  });
  if (!practice) notFound();

  const displayName = user.preferredName ?? user.name;

  // Counts that drive the guided checklist.
  const [deviceCount, devicesPlaced, devicesAssigned, locationCount, mediaCount, builtPlaylists] =
    await Promise.all([
      prisma.device.count({ where: { practiceId: practice.id } }),
      prisma.device.count({ where: { practiceId: practice.id, locationId: { not: null } } }),
      prisma.device.count({ where: { practiceId: practice.id, assignedPlaylistId: { not: null } } }),
      prisma.location.count({ where: { practiceId: practice.id } }),
      prisma.media.count({ where: { practiceId: practice.id } }),
      prisma.playlist.count({ where: { practiceId: practice.id, items: { some: {} } } }),
    ]);

  const s = (n: number) => (n === 1 ? "" : "s");

  const steps: SetupStep[] = [
    {
      key: "pair",
      title: "Pair your first screen",
      description:
        "Open the ClinicScreen player on the TV or device. It shows a short pairing code — enter that code here to connect it.",
      detail: deviceCount > 0 ? `${deviceCount} screen${s(deviceCount)} paired` : "No screens paired yet",
      done: deviceCount > 0,
      href: "screens",
      cta: "Pair a screen",
      tour: "pair",
    },
    {
      key: "place",
      title: "Tell us where each screen is",
      description:
        locationCount === 0
          ? "Add a location such as Main Office, then assign each screen to its room so staff know which screen is which."
          : "Assign each screen to its room so staff know which screen is which.",
      detail:
        deviceCount === 0
          ? "Pair a screen first"
          : `${devicesPlaced} of ${deviceCount} screen${s(deviceCount)} placed`,
      done: deviceCount > 0 && locationCount > 0 && devicesPlaced === deviceCount,
      href: locationCount === 0 ? "locations" : "screens",
      cta: locationCount === 0 ? "Add a location" : "Place your screens",
      tour: locationCount === 0 ? "addLocation" : "place",
    },
    {
      key: "media",
      title: "Upload what patients should see",
      description:
        "Add the videos and images you want playing — health tips, welcome messages, promotions, anything.",
      detail: mediaCount > 0 ? `${mediaCount} file${s(mediaCount)} uploaded` : "No media uploaded yet",
      done: mediaCount > 0,
      href: "media",
      cta: "Upload media",
      tour: "upload",
    },
    {
      key: "playlist",
      title: "Put it into a playlist",
      description: "Group your media into a playlist — that is the loop a screen plays on repeat.",
      detail: builtPlaylists > 0 ? `${builtPlaylists} playlist${s(builtPlaylists)} ready` : "No playlists built yet",
      done: builtPlaylists > 0,
      href: "playlists",
      cta: "Build a playlist",
      tour: "build",
    },
    {
      key: "assign",
      title: "Send the playlist to your screens",
      description: "Assign a playlist to each screen. As soon as you do, it starts playing right away.",
      detail:
        deviceCount === 0
          ? "Pair a screen first"
          : `${devicesAssigned} of ${deviceCount} screen${s(deviceCount)} playing`,
      done: deviceCount > 0 && devicesAssigned === deviceCount,
      href: "screens",
      cta: "Assign a playlist",
      tour: "assign",
    },
  ];

  return (
    <div className="practice-page mx-auto min-h-[calc(100vh-9rem)] max-w-[1100px]">
      {/* Hero — Windows-style greeting */}
      <section className="py-8 md:py-10">
        <p className="text-sm font-medium text-blue-700 dark:text-blue-400">
          {practice.specialty ?? "General practice"} · {practice.name}
        </p>
        <Greeting name={displayName} className="mt-2 text-4xl font-light tracking-tight md:text-5xl" />
        <p className="mt-3 max-w-xl text-base text-slate-500 dark:text-slate-400">
          {practice.name} is showing {practice._count.media} media item
          {practice._count.media === 1 ? "" : "s"} across {practice._count.playlists} playlist
          {practice._count.playlists === 1 ? "" : "s"}.
        </p>
      </section>

      {/* Guided setup */}
      <SetupChecklist practiceId={practice.id} steps={steps} />
    </div>
  );
}
