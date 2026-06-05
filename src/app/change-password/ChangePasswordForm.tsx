"use client";

import { useFormState, useFormStatus } from "react-dom";
import { completeChangePassword, type ChangePasswordState } from "./actions";
import { Input, Label, Button } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Saving…" : "Set new password"}
    </Button>
  );
}

export default function ChangePasswordForm() {
  const [state, action] = useFormState<ChangePasswordState, FormData>(completeChangePassword, {});

  return (
    <form action={action} className="space-y-3">
      <div>
        <Label>New password</Label>
        <Input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <Label>Confirm new password</Label>
        <Input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <p className="text-xs text-slate-400">
        At least 8 characters, with an uppercase letter, a lowercase letter, and a number.
      </p>
      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      <SubmitButton />
    </form>
  );
}
