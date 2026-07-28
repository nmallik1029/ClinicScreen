import Link from "next/link";
import { getSetupSteps } from "@/lib/setup-steps";
import { requirePracticeAccess } from "@/lib/auth";
import SetupProgressBar from "@/components/SetupProgressBar";

// Wraps every page under a practice. Computes the guided-setup state once and
// renders the persistent bottom progress bar (the bar hides itself on the
// checklist/overview page and once setup is complete).
export default async function PracticeLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: { practiceId: string };
}) {
  const [user, steps] = await Promise.all([
    requirePracticeAccess(params.practiceId),
    getSetupSteps(params.practiceId),
  ]);

  return (
    <>
      {/* The global header is hidden inside a practice, so give superadmins a way
          back to their panel (office admins only ever see their own practice). */}
      {user.role === "SUPERADMIN" && (
        <div className="px-6 pt-4">
          <Link
            href="/superadmin"
            prefetch
            className="inline-flex items-center gap-1 text-sm font-medium text-slate-500 transition-colors hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
          >
            <span aria-hidden>←</span> Superadmin
          </Link>
        </div>
      )}
      {/* Room for the fixed bottom bar so it never covers page content. */}
      <div className="pb-24">{children}</div>
      <SetupProgressBar practiceId={params.practiceId} steps={steps} />
    </>
  );
}
