import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { requirePracticeAccess } from "@/lib/auth";
import MediaUploadForm from "./MediaUploadForm";
import MediaItemActions from "./MediaItemActions";

export default async function MediaPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  // Independent queries — run them together instead of serially.
  const [practice, media] = await Promise.all([
    prisma.practice.findUnique({
      where: { id: params.practiceId },
      include: { _count: { select: { devices: true, locations: true, playlists: true } } },
    }),
    prisma.media.findMany({
      where: { practiceId: params.practiceId },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  if (!practice) notFound();
  return (
    <div className="practice-page">
      <PageHeader title={practice.name} subtitle="Media" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            {media.length === 0 ? (
              <p className="text-sm text-slate-500">No media yet. Upload a file to get started.</p>
            ) : (
              <ul className="divide-y">
                {media.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 py-3">
                    <div className="flex h-16 w-24 shrink-0 items-center justify-center overflow-hidden rounded bg-slate-100">
                      {m.type === "IMAGE" ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.url} alt={m.title} className="h-full w-full object-cover" />
                      ) : (
                        <video src={m.url} className="h-full w-full object-cover" muted preload="metadata" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{m.title}</p>
                      <p className="text-xs text-slate-500">
                        {m.type} · {m.durationSeconds ? `${m.durationSeconds}s · ` : ""}
                        {m.createdAt.toLocaleDateString()}
                      </p>
                      <a
                        href={m.url}
                        target="_blank"
                        className="block truncate text-xs text-blue-600 hover:underline"
                      >
                        {m.url}
                      </a>
                    </div>
                    <MediaItemActions practiceId={practice.id} mediaId={m.id} />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-medium">Upload media</h2>
          <MediaUploadForm practiceId={practice.id} />
        </Card>
      </div>
    </div>
  );
}
