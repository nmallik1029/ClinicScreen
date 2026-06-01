import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Tabs, Input, Select, Label, Button } from "@/components/ui";
import { createMedia } from "../actions";
import { requirePracticeAccess } from "@/lib/auth";

export default async function MediaPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  const practice = await prisma.practice.findUnique({ where: { id: params.practiceId } });
  if (!practice) notFound();

  const media = await prisma.media.findMany({
    where: { practiceId: practice.id },
    orderBy: { title: "asc" },
  });

  return (
    <div>
      <PageHeader title={practice.name} subtitle="Media" />
      <Tabs practiceId={practice.id} active="Media" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            {media.length === 0 ? (
              <p className="text-sm text-slate-500">No media yet.</p>
            ) : (
              <ul className="divide-y">
                {media.map((m) => (
                  <li key={m.id} className="py-3">
                    <p className="font-medium">{m.title}</p>
                    <p className="text-xs text-slate-500">
                      {m.type} · {m.durationSeconds ? `${m.durationSeconds}s · ` : ""}
                      <span className="break-all">{m.url}</span>
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <Card>
          <h2 className="mb-3 font-medium">Add media</h2>
          <p className="mb-3 text-xs text-slate-500">
            Paste a URL for now. File uploads come later.
          </p>
          <form action={createMedia.bind(null, practice.id)} className="space-y-3">
            <div>
              <Label>Title</Label>
              <Input name="title" placeholder="e.g. Blood Pressure Basics" required />
            </div>
            <div>
              <Label>Type</Label>
              <Select name="type" defaultValue="VIDEO">
                <option value="VIDEO">Video</option>
                <option value="IMAGE">Image</option>
              </Select>
            </div>
            <div>
              <Label>URL</Label>
              <Input name="url" placeholder="https://..." required />
            </div>
            <div>
              <Label>Duration seconds (optional)</Label>
              <Input name="durationSeconds" type="number" min="1" placeholder="e.g. 30" />
            </div>
            <Button type="submit">Add media</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
