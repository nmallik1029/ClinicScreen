import Link from "next/link";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { prisma } from "@/lib/prisma";
import { requirePracticeAccess } from "@/lib/auth";
import { deviceStatus } from "@/lib/status";
import { expireStalePending } from "@/lib/commands";
import { getSetupSteps } from "@/lib/setup-steps";
import { toPlayerItems } from "@/lib/player-items";
import ScreenCard from "@/components/ScreenCard";
import SetupStepsCard from "@/components/SetupStepsCard";
import StepDoneBanner from "@/components/StepDoneBanner";

export default async function ScreensPage({ params }: { params: { practiceId: string } }) {
  const user = await requirePracticeAccess(params.practiceId);
  // One parallel batch instead of a serial chain of round-trips.
  const [practice, devices, steps] = await Promise.all([
    prisma.practice.findUnique({ where: { id: params.practiceId } }),
    prisma.device.findMany({
      where: { practiceId: params.practiceId },
      orderBy: { name: "asc" },
      include: {
        location: true,
        assignedPlaylist: {
          include: { items: { orderBy: { position: "asc" }, include: { media: true, doctor: true } } },
        },
      },
    }),
    getSetupSteps(params.practiceId),
  ]);
  if (!practice) notFound();

  // Housekeeping (expire timed-out pairing codes) — off the render critical path.
  void expireStalePending({ practiceId: params.practiceId }).catch(() => {});

  const displayName = user.preferredName ?? user.name;

  return (
    <div className="practice-page">
      {/* Greeting + sign out (the global header is hidden inside a practice) */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-light tracking-tight md:text-4xl">Hello, {displayName}</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{practice.name}</p>
        </div>
        <form action="/auth/logout" method="post">
          <button className="text-xs text-slate-400 transition-colors hover:text-slate-700 dark:hover:text-slate-200">
            Sign out
          </button>
        </form>
      </div>

      <Suspense fallback={null}>
        <StepDoneBanner steps={steps} />
      </Suspense>

      {/* Grid on the left, setup card as a sidebar on the right. Flex so the grid
          reclaims the full width once the setup card removes itself. */}
      <div className="mt-2 flex flex-col gap-6 lg:flex-row">
        <div className="grid h-fit flex-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {devices.map((d) => {
            const items = d.assignedPlaylist?.items ?? [];
            return (
              <ScreenCard
                key={d.id}
                practiceId={practice.id}
                deviceId={d.id}
                name={d.name}
                locationName={d.location?.name ?? null}
                roomType={d.roomType}
                status={deviceStatus(d.lastSeenAt)}
                previewItems={toPlayerItems(items)}
              />
            );
          })}

          {/* Add / pair a screen */}
          <Link
            href={`/practices/${practice.id}/screens/pair`}
            className="flex min-h-[180px] flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 p-6 text-center text-slate-500 transition-colors hover:border-blue-400 hover:bg-blue-50/40 hover:text-blue-600 dark:border-slate-700 dark:hover:border-blue-700 dark:hover:bg-blue-950/30"
          >
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-2xl leading-none dark:bg-slate-800">
              +
            </span>
            <span className="text-sm font-medium">Pair a screen</span>
            <span className="text-xs">Connect a new TV or device</span>
          </Link>
        </div>

        <SetupStepsCard practiceId={practice.id} steps={steps} />
      </div>
    </div>
  );
}
