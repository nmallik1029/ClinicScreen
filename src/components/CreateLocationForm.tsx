"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Button } from "@/components/ui";
import { createLocation } from "@/app/practices/[practiceId]/actions";
import { completeStep } from "@/lib/step-complete";

// Client wrapper around the createLocation server action so we can confirm +
// animate the bottom progress bar and return to the checklist on success.
export default function CreateLocationForm({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("name") ?? "").trim()) return;
    startTransition(async () => {
      await createLocation(practiceId, fd);
      formRef.current?.reset();
      await completeStep(router, practiceId, "place");
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input name="name" placeholder="e.g. Main Office" required data-tour="location-name" />
      </div>
      <div>
        <Label>Address (optional)</Label>
        <Input name="address" placeholder="123 Heart St" />
      </div>
      <Button type="submit" disabled={pending} data-tour="location-submit">
        {pending ? "Adding…" : "Add location"}
      </Button>
    </form>
  );
}
