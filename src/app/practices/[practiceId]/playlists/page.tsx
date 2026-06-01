import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Tabs, Input, Label, Button } from "@/components/ui";
import { createPlaylist } from "../actions";
import { requirePracticeAccess } from "@/lib/auth";

export default async function PlaylistsPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({ where: { id: params.practiceId } });
  if (!practice) notFound();

  const playlists = await prisma.playlist.findMany({
    where: { practiceId: practice.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, devices: true } } },
  });

  return (
    <div>
      <PageHeader title={practice.name} subtitle="Playlists" />
      <Tabs practiceId={practice.id} active="Playlists" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            {playlists.length === 0 ? (
              <p className="text-sm text-slate-500">No playlists yet.</p>
            ) : (
              <ul className="divide-y">
                {playlists.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <Link
                        href={`/practices/${practice.id}/playlists/${p.id}`}
                        className="font-medium text-blue-700"
                      >
                        {p.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {p._count.items} items · on {p._count.devices} screens
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-medium">New playlist</h2>
          <form action={createPlaylist.bind(null, practice.id)} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Waiting Room Loop" required />
            </div>
            <Button type="submit">Create playlist</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
