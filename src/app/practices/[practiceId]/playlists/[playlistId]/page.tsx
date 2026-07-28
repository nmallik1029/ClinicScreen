import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Input, Select, Label, Button } from "@/components/ui";
import { addPlaylistItem, removePlaylistItem } from "../../actions";
import { requirePracticeAccess } from "@/lib/auth";

export default async function PlaylistDetailPage({
  params,
}: {
  params: { practiceId: string; playlistId: string };
}) {
  await requirePracticeAccess(params.practiceId);
  // Independent queries — run them together instead of serially.
  const [playlist, media] = await Promise.all([
    prisma.playlist.findUnique({
      where: { id: params.playlistId },
      include: {
        items: { orderBy: { position: "asc" }, include: { media: true } },
        devices: true,
      },
    }),
    prisma.media.findMany({
      where: { practiceId: params.practiceId },
      orderBy: { title: "asc" },
    }),
  ]);
  if (!playlist || playlist.practiceId !== params.practiceId) notFound();

  return (
    <div>
      <PageHeader
        title={playlist.name}
        subtitle={`Playing on ${playlist.devices.length} screen(s)`}
        action={
          <Link href={`/practices/${params.practiceId}/playlists`} className="text-sm text-blue-700">
            ← Back to playlists
          </Link>
        }
      />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <h2 className="mb-3 font-medium">Items</h2>
            {playlist.items.length === 0 ? (
              <p className="text-sm text-slate-500">No items yet. Add media on the right.</p>
            ) : (
              <ol className="space-y-2">
                {playlist.items.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-center justify-between rounded border px-3 py-2 text-sm"
                  >
                    <span>
                      <span className="mr-2 text-slate-400">{item.position}.</span>
                      {item.media?.title ?? "Doctor card"}{" "}
                      <span className="text-slate-400">· {item.media?.type ?? "DOCTOR"}</span>
                    </span>
                    <form
                      action={removePlaylistItem.bind(
                        null,
                        params.practiceId,
                        playlist.id,
                        item.id
                      )}
                    >
                      <Button type="submit" variant="danger">
                        Remove
                      </Button>
                    </form>
                  </li>
                ))}
              </ol>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-medium">Add media</h2>
          {media.length === 0 ? (
            <p className="text-sm text-slate-500">Create media first.</p>
          ) : (
            <form action={addPlaylistItem.bind(null, params.practiceId, playlist.id)} className="space-y-3">
              <div>
                <Label>Media</Label>
                <Select name="mediaId" defaultValue="">
                  <option value="" disabled>
                    Choose media…
                  </option>
                  {media.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.title} ({m.type})
                    </option>
                  ))}
                </Select>
              </div>
              <Button type="submit">Add to playlist</Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
