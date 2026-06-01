import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { Card } from "@/components/ui";
import OnboardingForm from "./OnboardingForm";

export default async function OnboardingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  // Onboarding is for practice (office) admins only; superadmins skip it.
  if (user.role !== "OFFICE_ADMIN" || user.onboardedAt) redirect("/");

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <h1 className="text-xl font-semibold">Welcome to ClinicScreen</h1>
        <p className="mt-1 mb-4 text-sm text-slate-600">
          Let&apos;s finish setting up your account. Choose a new password and tell us what to call you.
        </p>
        <OnboardingForm defaultName={user.name} />
      </Card>
    </div>
  );
}
