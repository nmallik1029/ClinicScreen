"use client";

import { useFormState, useFormStatus } from "react-dom";
import { createMedia } from "../actions";
import type { MediaFormState } from "@/lib/upload";
import { Input, Label, Button } from "@/components/ui";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending}>
      {pending ? "Uploading…" : "Upload media"}
    </Button>
  );
}

export default function MediaUploadForm({ practiceId }: { practiceId: string }) {
  const [state, action] = useFormState<MediaFormState, FormData>(
    createMedia.bind(null, practiceId),
    {}
  );

  return (
    <form action={action} className="space-y-3">
      <div>
        <Label>Title</Label>
        <Input name="title" placeholder="e.g. Blood Pressure Basics" required />
      </div>
      <div>
        <Label>File</Label>
        <input
          type="file"
          name="file"
          required
          accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700 hover:file:bg-blue-100"
        />
        <p className="mt-1 text-xs text-slate-400">
          Images: jpg, png, webp (max 10 MB). Videos: mp4, webm (max 100 MB).
        </p>
      </div>
      <div>
        <Label>Duration seconds (optional)</Label>
        <Input name="durationSeconds" type="number" min="1" placeholder="e.g. 30" />
      </div>

      {state.error && <p className="text-sm text-red-600">{state.error}</p>}
      {state.ok && <p className="text-sm text-green-600">Uploaded successfully.</p>}

      <SubmitButton />
    </form>
  );
}
