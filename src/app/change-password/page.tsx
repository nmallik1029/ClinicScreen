import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import ChangePasswordForm from "./ChangePasswordForm";

// Dedicated "set a new password" screen shown after an admin resets someone's
// password. Uses getCurrentUser (not requireUser) so it isn't caught by the
// must-change-password redirect itself.
export default async function ChangePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="mx-auto max-w-md">
      <h1 className="text-2xl font-semibold">Set a new password</h1>
      <p className="mt-1 text-sm text-slate-500">
        Your password was reset. Choose a new password to continue to ClinicScreen.
      </p>
      <Card className="mt-6">
        <ChangePasswordForm />
      </Card>
    </div>
  );
}
