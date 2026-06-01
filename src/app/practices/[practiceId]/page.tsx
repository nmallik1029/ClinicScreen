import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, Tabs } from "@/components/ui";
import { requirePracticeAccess } from "@/lib/auth";
import { deviceStatus } from "@/lib/status";

function greetingFor(date: Date) {
  const h = date.getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default async function OverviewPage({ params }: { params: { practiceId: string } }) {
  const user = await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({
    where: { id: params.practiceId },
    include: {
      _count: { select: { devices: true, locations: true, media: true, playlists: true } },
    },
  });
  if (!practice) notFound();

  const devices = await prisma.device.findMany({
    where: { practiceId: practice.id },
    select: { lastSeenAt: true },
  });
  const onlineCount = devices.filter((d) => deviceStatus(d.lastSeenAt) === "ONLINE").length;

  const stats = [
    { label: "Screens", value: practice._count.devices, href: "screens" },
    { label: "Locations", value: practice._count.locations, href: "locations" },
    { label: "Media", value: practice._count.media, href: "media" },
    { label: "Playlists", value: practice._count.playlists, href: "playlists" },
  ];

  const displayName = user.preferredName ?? user.name;

  return (
    <div>
      <Tabs practiceId={practice.id} active="Overview" />

      <div className="mb-6">
        <h1 className="text-2xl font-semibold">
          {greetingFor(new Date())}, {displayName}
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          {practice.name} · {practice.specialty ?? "General practice"}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        {stats.map((s) => (
          <Link key={s.label} href={`/practices/${practice.id}/${s.href}`}>
            <Card className="hover:border-blue-400">
              <p className="text-3xl font-semibold">{s.value}</p>
              <p className="text-sm text-slate-500">{s.label}</p>
            </Card>
          </Link>
        ))}
      </div>

      <Card className="mt-6">
        <p className="text-sm text-slate-600">
          {onlineCount} of {practice._count.devices} screens are currently online.
        </p>
      </Card>
    </div>
  );
}
