import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";

export default async function PracticeDetailPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();
  const practice = await prisma.practice.findUnique({
    where: { id: params.id },
    include: {
      locations: { orderBy: { name: "asc" } },
      devices: { orderBy: { name: "asc" }, include: { assignedPlaylist: true } },
      media: { orderBy: { title: "asc" } },
      playlists: { orderBy: { name: "asc" }, include: { _count: { select: { items: true } } } },
    },
  });

  if (!practice) notFound();

  return (
    <div>
      <PageHeader
        title={practice.name}
        subtitle={`${practice.specialty ?? "General"} · Superadmin view`}
        action={
          <Link href={`/practices/${practice.id}`} className="text-sm text-blue-700">
            Open office dashboard →
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <h2 className="mb-3 font-medium">Locations ({practice.locations.length})</h2>
          <ul className="space-y-1 text-sm">
            {practice.locations.map((l) => (
              <li key={l.id}>
                {l.name} <span className="text-slate-400">{l.address}</span>
              </li>
            ))}
            {practice.locations.length === 0 && <li className="text-slate-500">None</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Screens ({practice.devices.length})</h2>
          <ul className="space-y-1 text-sm">
            {practice.devices.map((d) => (
              <li key={d.id} className="flex items-center justify-between">
                <span>
                  {d.name}{" "}
                  <span className="text-slate-400">
                    {d.assignedPlaylist ? `· ${d.assignedPlaylist.name}` : "· no playlist"}
                  </span>
                </span>
                <StatusBadge status={d.status} />
              </li>
            ))}
            {practice.devices.length === 0 && <li className="text-slate-500">None</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Media ({practice.media.length})</h2>
          <ul className="space-y-1 text-sm">
            {practice.media.map((m) => (
              <li key={m.id}>
                {m.title} <span className="text-slate-400">· {m.type}</span>
              </li>
            ))}
            {practice.media.length === 0 && <li className="text-slate-500">None</li>}
          </ul>
        </Card>

        <Card>
          <h2 className="mb-3 font-medium">Playlists ({practice.playlists.length})</h2>
          <ul className="space-y-1 text-sm">
            {practice.playlists.map((p) => (
              <li key={p.id}>
                {p.name} <span className="text-slate-400">· {p._count.items} items</span>
              </li>
            ))}
            {practice.playlists.length === 0 && <li className="text-slate-500">None</li>}
          </ul>
        </Card>
      </div>
    </div>
  );
}
