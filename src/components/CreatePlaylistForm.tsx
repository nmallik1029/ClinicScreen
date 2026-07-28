"use client";

import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Input, Label, Button } from "@/components/ui";
import { createPlaylist } from "@/app/practices/[practiceId]/actions";
import { completeStep } from "@/lib/step-complete";

// Client wrapper around the createPlaylist server action so we can confirm +
// animate the bottom progress bar and return to the checklist on success.
export default function CreatePlaylistForm({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (!String(fd.get("name") ?? "").trim()) return;
    startTransition(async () => {
      await createPlaylist(practiceId, fd);
      formRef.current?.reset();
      await completeStep(router, practiceId, "playlist");
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3">
      <div>
        <Label>Name</Label>
        <Input name="name" placeholder="e.g. Waiting Room Loop" required data-tour="playlist-name" />
      </div>
      <Button type="submit" disabled={pending} data-tour="playlist-submit">
        {pending ? "Creating…" : "Create playlist"}
      </Button>
    </form>
  );
}
