"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { presignMediaAction, finalizeMediaAction, createMedia } from "../actions";
import { Input, Label, Button } from "@/components/ui";

// Upload the file straight to R2 via the presigned URL, reporting progress.
function putToR2(
  uploadUrl: string,
  contentType: string,
  file: File,
  onProgress: (pct: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () =>
      xhr.status >= 200 && xhr.status < 300
        ? resolve()
        : reject(new Error(`Upload failed (${xhr.status})`));
    xhr.onerror = () => reject(new Error("Network error during upload."));
    xhr.send(file);
  });
}

export default function MediaUploadForm({ practiceId }: { practiceId: string }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(false);

    const form = e.currentTarget;
    const fd = new FormData(form);
    const title = String(fd.get("title") ?? "").trim();
    const file = fd.get("file");
    const durationRaw = String(fd.get("durationSeconds") ?? "").trim();
    const durationSeconds = durationRaw ? Number(durationRaw) : null;

    if (!title) return setError("Please enter a title.");
    if (!(file instanceof File) || file.size === 0) return setError("Please choose a file to upload.");

    setUploading(true);
    setProgress(0);
    try {
      const presign = await presignMediaAction(practiceId, file.name, file.size);
      if (!presign.ok) {
        setError(presign.error);
        return;
      }

      if (presign.mode === "local") {
        // Dev / no R2 configured: fall back to the server-side disk upload.
        const res = await createMedia(practiceId, {}, fd);
        if (res.error) {
          setError(res.error);
          return;
        }
      } else {
        await putToR2(presign.uploadUrl, presign.contentType, file, setProgress);
        const fin = await finalizeMediaAction(practiceId, {
          title,
          url: presign.publicUrl,
          durationSeconds,
        });
        if (fin.error) {
          setError(fin.error);
          return;
        }
      }

      setOk(true);
      setProgress(100);
      form.reset();
      router.refresh();
    } catch {
      setError("Upload failed. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="space-y-3" data-tour="media-form">
      <div>
        <Label>Title</Label>
        <Input name="title" placeholder="e.g. Blood Pressure Basics" required data-tour="media-title" />
      </div>
      <div>
        <Label>File</Label>
        <input
          type="file"
          name="file"
          required
          accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm"
          className="block w-full text-sm text-slate-600 file:mr-3 file:rounded file:border-0 file:bg-blue-50 file:px-3 file:py-1.5 file:text-blue-700 hover:file:bg-blue-100"
          data-tour="media-file"
        />
        <p className="mt-1 text-xs text-slate-400">
          Images: jpg, png, webp (max 10 MB). Videos: mp4, webm (max 100 MB).
        </p>
      </div>
      <div>
        <Label>Duration seconds (optional)</Label>
        <Input name="durationSeconds" type="number" min="1" placeholder="e.g. 30" />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      {ok && <p className="text-sm text-green-600">Uploaded successfully.</p>}

      {uploading ? (
        <div>
          <div className="h-2 w-full overflow-hidden rounded bg-slate-200">
            <div
              className="h-2 rounded bg-blue-600 transition-all duration-200"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-1 text-xs text-slate-500">Uploading… {progress}%</p>
        </div>
      ) : (
        <Button type="submit" data-tour="media-submit">
          Upload media
        </Button>
      )}
    </form>
  );
}
