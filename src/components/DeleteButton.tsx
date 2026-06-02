"use client";

import { Button } from "@/components/ui";

/**
 * Submits a bound server action after a confirm() prompt. Pass a server action
 * already bound to its args, e.g. deleteScreen.bind(null, practiceId, id).
 */
export default function DeleteButton({
  action,
  confirmText,
  label = "Delete",
}: {
  action: () => Promise<void>;
  confirmText: string;
  label?: string;
}) {
  return (
    <form
      action={action}
      className="inline"
      onSubmit={(e) => {
        if (!confirm(confirmText)) e.preventDefault();
      }}
    >
      <Button type="submit" variant="danger">
        {label}
      </Button>
    </form>
  );
}
