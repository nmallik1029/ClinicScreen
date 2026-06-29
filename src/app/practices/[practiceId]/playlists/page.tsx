import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Input, Label, Button } from "@/components/ui";
import { createPlaylist, deletePlaylist } from "../actions";
import { requirePracticeAccess } from "@/lib/auth";
import DeleteButton from "@/components/DeleteButton";

export default async function PlaylistsPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({
    where: { id: params.practiceId },
    include: { _count: { select: { devices: true, locations: true, media: true } } },
  });
  if (!practice) notFound();

  const playlists = await prisma.playlist.findMany({
    where: { practiceId: practice.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { items: true, devices: true } } },
  });
  return (
    <div className="practice-page">
      <PageHeader title={practice.name} subtitle="Playlists" />

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
                    <DeleteButton
                      action={deletePlaylist.bind(null, practice.id, p.id)}
                      confirmText={`Delete "${p.name}"? It will be removed from any screens using it.`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card data-tour="playlists-form">
          <h2 className="mb-3 font-medium">New playlist</h2>
          <form action={createPlaylist.bind(null, practice.id)} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Waiting Room Loop" required data-tour="playlist-name" />
            </div>
            <Button type="submit" data-tour="playlist-submit">
              Create playlist
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
