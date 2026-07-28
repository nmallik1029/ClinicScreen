import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { PageHeader, Card } from "@/components/ui";
import { requirePracticeAccess } from "@/lib/auth";
import DoctorImport from "@/components/DoctorImport";
import DoctorList from "@/components/DoctorList";

export default async function DoctorsPage({ params }: { params: { practiceId: string } }) {
  await requirePracticeAccess(params.practiceId);
  const [practice, doctors] = await Promise.all([
    prisma.practice.findUnique({ where: { id: params.practiceId } }),
    prisma.doctor.findMany({ where: { practiceId: params.practiceId }, orderBy: { name: "asc" } }),
  ]);
  if (!practice) notFound();

  return (
    <div className="practice-page">
      <PageHeader title={practice.name} subtitle="Doctors" />

      <div className="grid gap-6 md:grid-cols-3">
        <div className="md:col-span-2">
          <Card>
            <DoctorList
              practiceId={params.practiceId}
              missingBlurbCount={doctors.filter((d) => !d.screenBlurb).length}
              doctors={doctors.map((d) => ({
                id: d.id,
                name: d.name,
                credentials: d.credentials,
                title: d.title,
                specialty: d.specialty,
                photoUrl: d.photoUrl,
                sourceUrl: d.sourceUrl,
                scrapedAt: d.scrapedAt.toISOString(),
              }))}
            />
          </Card>
        </div>

        <div>
          <Card>
            <h2 className="mb-1 text-sm font-semibold">Import from website</h2>
            <p className="mb-3 text-xs text-slate-500">
              Paste the practice&apos;s website. We&apos;ll find the physician pages, pull their
              details, and show you what we found before anything is saved.
            </p>
            <DoctorImport practiceId={params.practiceId} />
          </Card>
        </div>
      </div>
    </div>
  );
}
