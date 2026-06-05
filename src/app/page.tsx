import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.role === "OFFICE_ADMIN" && !user.onboardedAt) redirect("/onboarding");
  if (user.mustChangePassword) redirect("/change-password");
  if (user.role === "SUPERADMIN") redirect("/superadmin");
  if (user.practiceId) redirect(`/practices/${user.practiceId}`);
  redirect("/unauthorized");
}
