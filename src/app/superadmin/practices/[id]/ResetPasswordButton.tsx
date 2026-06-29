"use client";

import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { resetAdminPassword, type ResetState } from "@/app/superadmin/actions";

function TriggerButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="text-xs font-medium text-amber-700 transition hover:text-amber-900 disabled:opacity-50 dark:text-amber-400 dark:hover:text-amber-300"
    >
      {pending ? "Resetting…" : "Reset password"}
    </button>
  );
}

export default function ResetPasswordButton({
  practiceId,
  userId,
  userName,
}: {
  practiceId: string;
  userId: string;
  userName: string;
}) {
  const [state, action] = useFormState<ResetState, FormData>(
    resetAdminPassword.bind(null, practiceId, userId),
    {}
  );
  const [copied, setCopied] = useState(false);

  async function copy() {
    if (!state.tempPassword) return;
    try {
      await navigator.clipboard.writeText(state.tempPassword);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked — user can select manually */
    }
  }

  return (
    <div>
      <form action={action}>
        <TriggerButton />
      </form>

      {state.error && <p className="mt-1 text-xs text-red-600 dark:text-red-400">{state.error}</p>}

      {state.tempPassword && (
        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-900/60 dark:bg-amber-950/40">
          <div className="flex items-center gap-2 text-xs font-semibold text-amber-900 dark:text-amber-300">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <rect x="3" y="11" width="18" height="11" rx="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            Temporary password for {userName}
          </div>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 select-all rounded border border-amber-200 bg-white px-2.5 py-1.5 font-mono text-sm tracking-wide text-slate-800 dark:border-amber-900/60 dark:bg-slate-900 dark:text-slate-100">
              {state.tempPassword}
            </code>
            <button
              type="button"
              onClick={copy}
              className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-amber-700"
            >
              {copied ? "Copied!" : "Copy"}
            </button>
          </div>
          <p className="mt-2 text-xs leading-relaxed text-amber-800 dark:text-amber-400/90">
            Share this with {userName}. They'll sign in with it once, then be prompted to set their own
            password. Their previous sessions have been signed out.
          </p>
        </div>
      )}
    </div>
  );
}
