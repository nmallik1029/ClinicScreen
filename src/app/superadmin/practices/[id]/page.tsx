import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, StatusBadge } from "@/components/ui";
import { requireSuperadmin } from "@/lib/auth";
import { deviceStatus } from "@/lib/status";
import { setUserDisabled, deleteAdmin } from "@/app/superadmin/actions";
import AddAdminForm from "./AddAdminForm";
import DeleteButton from "@/components/DeleteButton";

export default async function PracticeDetailPage({ params }: { params: { id: string } }) {
  await requireSuperadmin();
  const practice = await prisma.practice.findUnique({
    where: { id: params.id },
    include: {
      users: { orderBy: { name: "asc" } },
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

      <Card className="mb-6">
        <h2 className="mb-3 font-medium">Admins ({practice.users.length})</h2>
        <ul className="divide-y">
          {practice.users.map((u) => (
            <li key={u.id} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p className="font-medium">
                  {u.preferredName ?? u.name}
                  {u.disabledAt && (
                    <span className="ml-2 rounded bg-red-100 px-1.5 py-0.5 text-xs text-red-700">
                      Disabled
                    </span>
                  )}
                </p>
                <p className="text-xs text-slate-500">
                  {u.email} · {u.role === "SUPERADMIN" ? "Superadmin" : "Office admin"}
                </p>
              </div>
              {u.role !== "SUPERADMIN" && (
                <div className="flex items-center gap-3">
                  <form action={setUserDisabled.bind(null, practice.id, u.id, !u.disabledAt)}>
                    <button
                      type="submit"
                      className={`text-xs ${u.disabledAt ? "text-green-700" : "text-red-600"} hover:underline`}
                    >
                      {u.disabledAt ? "Enable" : "Disable"}
                    </button>
                  </form>
                  <DeleteButton
                    action={deleteAdmin.bind(null, practice.id, u.id)}
                    confirmText={`Permanently remove ${u.name} (${u.email}) from this practice? Their quickAuth login still exists but loses access.`}
                    label="Delete"
                  />
                </div>
              )}
            </li>
          ))}
          {practice.users.length === 0 && <li className="py-2 text-slate-500">No admins yet.</li>}
        </ul>
        <div className="mt-4 border-t pt-4">
          <h3 className="mb-2 text-sm font-medium">Add admin</h3>
          <AddAdminForm practiceId={practice.id} />
        </div>
      </Card>

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
                <StatusBadge status={deviceStatus(d.lastSeenAt)} />
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
