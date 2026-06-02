"use client";

import { useFormState, useFormStatus } from "react-dom";
import { addPracticeAdmin } from "@/app/superadmin/actions";
import type { AddAdminState } from "@/app/superadmin/types";
import { Input, Label, Button } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Creating…" : "Create admin"}
    </Button>
  );
}

export default function AddAdminForm({ practiceId }: { practiceId: string }) {
  const [state, action] = useFormState<AddAdminState, FormData>(
    addPracticeAdmin.bind(null, practiceId),
    {}
  );

  return (
    <form action={action} className="grid gap-2 sm:grid-cols-3 sm:items-end">
      <div>
        <Label>Full name</Label>
        <Input name="name" placeholder="Neel Mallik" required />
      </div>
      <div>
        <Label>Email</Label>
        <Input name="email" type="email" placeholder="neel@practice.com" required />
      </div>
      <div>
        <Label>Username</Label>
        <Input name="username" placeholder="neelmallik" required />
      </div>

      <div className="sm:col-span-3">
        <SubmitButton />
      </div>

      {state.error && <p className="sm:col-span-3 text-sm text-red-600">{state.error}</p>}
      {state.message && (
        <p className="sm:col-span-3 rounded border border-green-200 bg-green-50 p-3 text-sm text-green-800">
          {state.message}
        </p>
      )}
      {state.tempPassword && (
        <div className="sm:col-span-3 rounded border border-green-200 bg-green-50 p-3 text-sm">
          <p className="font-medium text-green-800">Login created.</p>
          <p className="mt-1 text-green-700">
            Username <code className="rounded bg-white px-1">{state.username}</code> · Temporary
            password <code className="rounded bg-white px-1">{state.tempPassword}</code>
          </p>
          <p className="mt-1 text-xs text-green-700">
            Share this once — they&apos;ll set their own password on first sign-in. It won&apos;t be shown again.
          </p>
        </div>
      )}
    </form>
  );
}
