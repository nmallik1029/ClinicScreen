import { redirect } from "next/navigation";

// Screens is the home base for a practice — send the bare practice URL there.
export default function PracticeIndexPage({ params }: { params: { practiceId: string } }) {
  redirect(`/practices/${params.practiceId}/screens`);
}
