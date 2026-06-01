import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Tabs, Input, Label, Button } from "@/components/ui";
import { createLocation } from "../actions";
import { requirePracticeAccess } from "@/lib/auth";

export default async function LocationsPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({ where: { id: params.practiceId } });
  if (!practice) notFound();

  const locations = await prisma.location.findMany({
    where: { practiceId: practice.id },
    orderBy: { name: "asc" },
    include: { _count: { select: { devices: true } } },
  });

  return (
    <div>
      <PageHeader title={practice.name} subtitle="Locations" />
      <Tabs practiceId={practice.id} active="Locations" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            {locations.length === 0 ? (
              <p className="text-sm text-slate-500">No locations yet.</p>
            ) : (
              <ul className="divide-y">
                {locations.map((l) => (
                  <li key={l.id} className="py-3">
                    <p className="font-medium">{l.name}</p>
                    <p className="text-xs text-slate-500">
                      {l.address ?? "No address"} · {l._count.devices} screens
                    </p>
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
