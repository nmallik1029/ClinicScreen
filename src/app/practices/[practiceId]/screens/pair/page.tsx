import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card, Input, Select, Label, Button } from "@/components/ui";
import { createScreen } from "../../actions";
import { requirePracticeAccess } from "@/lib/auth";
import AddScreenByCode from "../AddScreenByCode";

export default async function PairScreenPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  // Independent queries — run them together instead of serially.
  const [practice, locations] = await Promise.all([
    prisma.practice.findUnique({ where: { id: params.practiceId } }),
    prisma.location.findMany({
      where: { practiceId: params.practiceId },
      orderBy: { name: "asc" },
    }),
  ]);
  if (!practice) notFound();

  return (
    <div className="practice-page mx-auto max-w-2xl">
      <Link
        href={`/practices/${practice.id}/screens`}
        className="text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200"
      >
        ← Back to screens
      </Link>
      <div className="mt-2">
        <PageHeader title="Pair a screen" subtitle={practice.name} />
      </div>

      <div className="mt-4 space-y-4">
        <Card data-tour="screens-pair-card">
          <h2 className="mb-1 font-medium">Pair with a code</h2>
          <p className="mb-3 text-xs text-slate-500">
            Set up a TV: open the ClinicScreen Player app on its PC and enter the code it shows.
          </p>
          <AddScreenByCode
            practiceId={practice.id}
            locations={locations.map((l) => ({ id: l.id, name: l.name }))}
          />
        </Card>

        <Card>
          <h2 className="mb-1 font-medium">Add screen manually</h2>
          <p className="mb-3 text-xs text-slate-500">
            Creates a screen + player link without a device present.
          </p>
          <form action={createScreen.bind(null, practice.id)} className="space-y-3">
            <div>
              <Label>Name</Label>
              <Input name="name" placeholder="e.g. Waiting Room" required />
            </div>
            <div>
              <Label>Room type (optional)</Label>
              <Input name="roomType" placeholder="e.g. Exam Room" />
            </div>
            <div>
              <Label>Location (optional)</Label>
              <Select name="locationId" defaultValue="">
                <option value="">None</option>
                {locations.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </Select>
            </div>
            <Button type="submit">Add screen</Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
