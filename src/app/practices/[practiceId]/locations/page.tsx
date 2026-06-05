import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Tabs, Input, Label, Button } from "@/components/ui";
import { createLocation, deleteLocation } from "../actions";
import { requirePracticeAccess } from "@/lib/auth";
import DeleteButton from "@/components/DeleteButton";

export default async function LocationsPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({
    where: { id: params.practiceId },
    include: { _count: { select: { devices: true, locations: true, media: true, playlists: true } } },
  });
  if (!practice) notFound();

  const locations = await prisma.location.findMany({
    where: { practiceId: practice.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { devices: true } } },
  });
  const activeLocations = locations.filter((l) => l._count.devices > 0).length;
  const metrics = {
    Screens: { value: practice._count.devices },
    Locations: { value: locations.length, note: `${activeLocations} with screens` },
    Media: { value: practice._count.media },
    Playlists: { value: practice._count.playlists },
  };

  return (
    <div className="practice-page">
      <PageHeader title={practice.name} subtitle="Locations" />
      <Tabs practiceId={practice.id} active="Locations" metrics={metrics} />

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

        <Card>
          <h2 className="mb-3 font-medium">Add location</h2>
          <form action={createLocation.bind(null, practice.id)} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Main Office" required />
            </div>
            <div>
              <Label>Address (optional)</Label>
              <Input name="address" placeholder="123 Heart St" />
            </div>
            <Button type="submit">Add location</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
