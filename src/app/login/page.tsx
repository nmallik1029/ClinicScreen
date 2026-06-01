import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/");

  return (
    <div className="mx-auto max-w-sm text-center">
      <Card>
        <h1 className="text-xl font-semibold">Sign in to ClinicScreen</h1>
        <p className="mt-2 text-sm text-slate-600">
          Use your quickAuth account to continue.
        </p>
        <a
          href="/auth/login"
          className="mt-4 inline-block rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Sign in with quickAuth
        </a>
      </Card>
    </div>
  );
}
