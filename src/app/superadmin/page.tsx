import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Input, Label, Button } from "@/components/ui";
import { createPractice } from "./actions";
import { requireSuperadmin } from "@/lib/auth";

export default async function SuperadminPage() {
  await requireSuperadmin();
  const practices = await prisma.practice.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { locations: true, devices: true, media: true, playlists: true } } },
  });

  return (
    <div>
      <PageHeader title="Practices" subtitle="Manage all practices on ClinicScreen." />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            {practices.length === 0 ? (
              <p className="text-sm text-slate-500">No practices yet. Create one to get started.</p>
            ) : (
              <ul className="divide-y">
                {practices.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-3">
                    <div>
                      <Link href={`/superadmin/practices/${p.id}`} className="font-medium text-blue-700">
                        {p.name}
                      </Link>
                      <p className="text-xs text-slate-500">
                        {p.specialty ?? "General"} · {p._count.locations} locations ·{" "}
                        {p._count.devices} screens · {p._count.media} media · {p._count.playlists} playlists
                      </p>
                    </div>
                    <Link
                      href={`/practices/${p.id}`}
                      className="text-sm text-slate-500 hover:text-slate-800"
                    >
                      Open dashboard →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-medium">New practice</h2>
          <form action={createPractice} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Test Cardiology Clinic" required />
            </div>
            <div>
              <Label>Specialty (optional)</Label>
              <Input name="specialty" placeholder="e.g. Cardiology" />
            </div>
            <Button type="submit">Create practice</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
