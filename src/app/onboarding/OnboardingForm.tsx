"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { completeOnboarding, type OnboardingState } from "./actions";
import { Input, Label, Button } from "@/components/ui";

function EyeIcon({ off }: { off?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {off ? (
        <>
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
          <line x1="1" y1="1" x2="23" y2="23" />
        </>
      ) : (
        <>
          <path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z" />
          <circle cx="12" cy="12" r="3" />
        </>
      )}
    </svg>
  );
}

function PasswordField({ name }: { name: string }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input name={name} type={show ? "text" : "password"} required className="pr-10" />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? "Hide password" : "Show password"}
        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
      >
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending} className="w-full">
      {pending ? "Saving…" : "Finish setup"}
    </Button>
  );
}

export default function OnboardingForm({ defaultName }: { defaultName: string }) {
  const [state, action] = useFormState<OnboardingState, FormData>(completeOnboarding, {});

  return (
    <form action={action} className="space-y-4">
      <div>
        <Label>Preferred name</Label>
        <Input name="preferredName" defaultValue={defaultName} placeholder="e.g. Neel" required />
        <p className="mt-1 text-xs text-slate-400">This is how we&apos;ll greet you.</p>
      </div>
      <div>
        <Label>New password</Label>
        <PasswordField name="password" />
        <p className="mt-1 text-xs text-slate-400">
          At least 8 characters with an uppercase letter, a lowercase letter, and a number.
        </p>
      </div>
      <div>
        <Label>Confirm new password</Label>
        <PasswordField name="confirmPassword" />
      </div>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
