"use client";

import { useEffect } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { Input, Select, Label, Button } from "@/components/ui";
import { claimScreenByCode, type ClaimState } from "../actions";
import { completeStep } from "@/lib/step-complete";

type LocationOption = { id: string; name: string };

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} data-tour="pair-submit">
      {pending ? "Pairing…" : "Pair screen"}
    </Button>
  );
}

export default function AddScreenByCode({
  practiceId,
  locations,
}: {
  practiceId: string;
  locations: LocationOption[];
}) {
  const router = useRouter();
  const action = claimScreenByCode.bind(null, practiceId);
  const [state, formAction] = useFormState<ClaimState, FormData>(action, {});

  // On success, animate the bottom progress bar then return to the checklist.
  useEffect(() => {
    if (state.ok) completeStep(router, practiceId, "pair");
  }, [state.ok, router, practiceId]);

  return (
    <form action={formAction} className="space-y-3">
      <div>
        <Label>Pairing code</Label>
        <Input
          name="code"
          placeholder="e.g. K7P-4Q2"
          autoComplete="off"
          autoCapitalize="characters"
          required
          className="font-mono uppercase tracking-widest"
          data-tour="pair-code"
        />
        <p className="mt-1 text-xs text-slate-500">
          Shown on the screen when the ClinicScreen Player app starts up.
        </p>
      </div>
      <div>
        <Label>Screen name</Label>
        <Input name="name" placeholder="e.g. Waiting Room" required data-tour="pair-name" />
      </div>
      <div>
        <Label>Room type (optional)</Label>
        <Input name="roomType" placeholder="e.g. Exam Room" />
      </div>
      <div>
        <Label>Location (optional)</Label>
        <Select name="locationId" defaultValue="">
          <option value="">None</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.name}
            </option>
          ))}
        </Select>
      </div>

      {state.error ? <p className="text-sm text-red-600">{state.error}</p> : null}
      {state.ok ? (
        <p className="text-sm text-green-700">
          Paired “{state.deviceName}”. The screen will start playing shortly.
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
