import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { devLoginEnabled } from "@/lib/dev-login";
import { Card } from "@/components/ui";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  const devLogin = devLoginEnabled();

  return (
    <div className="mx-auto max-w-sm text-center">
      <Card>
        <h1 className="text-xl font-semibold">Sign in to ClinicScreen</h1>

        {devLogin ? (
          <>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
              Local development environment.
            </p>
            <a
              href="/auth/dev-login"
              className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Developer sign-in
            </a>
            <p className="mt-3 text-xs text-slate-400">
              Signs you in as a local admin. Dev only — never available in production.
            </p>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-slate-600">Use your quickAuth account to continue.</p>
            <a
              href="/auth/login"
              className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Sign in with quickAuth
            </a>
          </>
        )}
      </Card>
    </div>
  );
}
