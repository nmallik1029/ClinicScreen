"use client";

import { useFormState, useFormStatus } from "react-dom";
import { useState } from "react";
import { deleteMedia, replaceMedia } from "../actions";
import type { MediaFormState } from "@/lib/upload";
import { Button } from "@/components/ui";

function ReplaceSubmit() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant="ghost" disabled={pending}>
      {pending ? "Replacing…" : "Upload replacement"}
    </Button>
  );
}

export default function MediaItemActions({
  practiceId,
  mediaId,
}: {
  practiceId: string;
  mediaId: string;
}) {
  const [showReplace, setShowReplace] = useState(false);
  const [state, replaceAction] = useFormState<MediaFormState, FormData>(
    replaceMedia.bind(null, practiceId, mediaId),
    {}
  );

  return (
    <div className="mt-1 flex flex-col items-end gap-1">
      <div className="flex gap-3 text-xs">
        <button
          type="button"
          onClick={() => setShowReplace((v) => !v)}
          className="text-blue-600 hover:underline"
        >
          Replace
        </button>
        <form
          action={deleteMedia.bind(null, practiceId, mediaId)}
          onSubmit={(e) => {
            if (!confirm("Delete this media? It will be removed from any playlists.")) {
              e.preventDefault();
            }
          }}
        >
          <button type="submit" className="text-red-600 hover:underline">
            Delete
          </button>
        </form>
      </div>

      {showReplace && (
        <form action={replaceAction} className="flex items-center gap-2">
          <input
            type="file"
            name="file"
            required
            accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm"
            className="text-xs file:mr-2 file:rounded file:border-0 file:bg-blue-50 file:px-2 file:py-1 file:text-blue-700"
          />
          <ReplaceSubmit />
        </form>
      )}
      {state.error && <p className="text-xs text-red-600">{state.error}</p>}
      {state.ok && <p className="text-xs text-green-600">Replaced.</p>}
    </div>
  );
}
