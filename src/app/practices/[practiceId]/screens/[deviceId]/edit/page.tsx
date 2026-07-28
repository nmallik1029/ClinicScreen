import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requirePracticeAccess } from "@/lib/auth";
import { loadScreenItems, toDoctorCardData, type LibraryMedia, type EditorDoctor } from "@/lib/screen-content";
import ScreenEditor from "@/components/ScreenEditor";

// The per-screen content editor (timeline + media panel + live preview).
export default async function ScreenEditPage({
  params,
}: {
  params: { practiceId: string; deviceId: string };
}) {
  await requirePracticeAccess(params.practiceId);

  const device = await prisma.device.findUnique({
    where: { id: params.deviceId },
    select: {
      id: true,
      name: true,
      practiceId: true,
      assignedPlaylistId: true,
    },
  });
  if (!device || device.practiceId !== params.practiceId) notFound();

  const [items, media, doctorRows] = await Promise.all([
    device.assignedPlaylistId ? loadScreenItems(device.assignedPlaylistId) : Promise.resolve([]),
    prisma.media.findMany({
      where: { practiceId: params.practiceId },
      orderBy: { createdAt: "desc" },
      select: { id: true, title: true, type: true, url: true, durationSeconds: true },
    }),
    prisma.doctor.findMany({ where: { practiceId: params.practiceId }, orderBy: { name: "asc" } }),
  ]);

  const library: LibraryMedia[] = media.map((m) => ({
    id: m.id,
    title: m.title,
    type: m.type as "VIDEO" | "IMAGE",
    url: m.url,
    durationSeconds: m.durationSeconds,
  }));

  const doctors: EditorDoctor[] = doctorRows.map((d) => ({ id: d.id, ...toDoctorCardData(d) }));

  return (
    <ScreenEditor
      practiceId={params.practiceId}
      deviceId={device.id}
      screenName={device.name}
      backHref={`/practices/${params.practiceId}/screens/${device.id}`}
      initialItems={items}
      initialLibrary={library}
      doctors={doctors}
    />
  );
}
