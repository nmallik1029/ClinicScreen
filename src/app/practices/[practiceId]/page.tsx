import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Tabs } from "@/components/ui";
import { requirePracticeAccess } from "@/lib/auth";

export default async function OverviewPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({
    where: { id: params.practiceId },
    include: {
      _count: { select: { devices: true, locations: true, media: true, playlists: true } },
    },
  });
  if (!practice) notFound();

  const onlineCount = await prisma.device.count({
    where: { practiceId: practice.id, status: "ONLINE" },
  });

  const stats = [
    { label: "Screens", value: practice._count.devices, href: "screens" },
    { label: "Locations", value: practice._count.locations, href: "locations" },
    { label: "Media", value: practice._count.media, href: "media" },
    { label: "Playlists", value: practice._count.playlists, href: "playlists" },
  ];

  return (
    <div>
      <PageHeader title={practice.name} subtitle={practice.specialty ?? "General practice"} />
      <Tabs practiceId={practice.id} active="Overview" />

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
