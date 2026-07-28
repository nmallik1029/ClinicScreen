import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { deleteLocation } from "../actions";
import { requirePracticeAccess } from "@/lib/auth";
import DeleteButton from "@/components/DeleteButton";
import CreateLocationForm from "@/components/CreateLocationForm";

export default async function LocationsPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  // Independent queries — run them together instead of serially.
  const [practice, locations] = await Promise.all([
    prisma.practice.findUnique({
      where: { id: params.practiceId },
      include: { _count: { select: { devices: true, locations: true, media: true, playlists: true } } },
    }),
    prisma.location.findMany({
      where: { practiceId: params.practiceId },
      orderBy: { name: "asc" },
      include: { _count: { select: { devices: true } } },
    }),
  ]);
  if (!practice) notFound();
  return (
    <div className="practice-page">
      <PageHeader title={practice.name} subtitle="Locations" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            {locations.length === 0 ? (
              <p className="text-sm text-slate-500">No locations yet.</p>
            ) : (
              <ul className="divide-y">
                {locations.map((l) => (
                  <li key={l.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="font-medium">{l.name}</p>
                      <p className="text-xs text-slate-500">
                        {l.address ?? "No address"} · {l._count.devices} screens
                      </p>
                    </div>
                    <DeleteButton
                      action={deleteLocation.bind(null, practice.id, l.id)}
                      confirmText={`Delete "${l.name}"? Its screens will be left without a location.`}
                    />
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card data-tour="locations-form">
          <h2 className="mb-3 font-medium">Add location</h2>
          <CreateLocationForm practiceId={practice.id} />
        </Card>
      </div>
    </div>
  );
}
