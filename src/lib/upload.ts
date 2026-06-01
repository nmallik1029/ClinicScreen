import { writeFile, mkdir } from "fs/promises";
import path from "path";
import crypto from "crypto";
import type { MediaType } from "@prisma/client";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const VIDEO_EXT = new Set(["mp4", "webm"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

export type MediaFormState = { error?: string; ok?: boolean };

type SaveResult = { ok: true; type: MediaType; url: string } | { ok: false; error: string };

/**
 * Validate and store an uploaded media file under public/uploads/<practiceId>/.
 * Returns the public URL path that Next.js (and the player) can serve.
 * Local-only for this step — swap this module for R2/S3 later without changing callers.
 */
export async function saveMediaFile(practiceId: string, file: File): Promise<SaveResult> {
  if (!file || file.size === 0) return { ok: false, error: "Please choose a file to upload." };

  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  let type: MediaType;
  let maxBytes: number;
  if (IMAGE_EXT.has(ext)) {
    type = "IMAGE";
    maxBytes = MAX_IMAGE_BYTES;
  } else if (VIDEO_EXT.has(ext)) {
    type = "VIDEO";
    maxBytes = MAX_VIDEO_BYTES;
  } else {
    return {
      ok: false,
      error: "Unsupported file type. Allowed: jpg, jpeg, png, webp, mp4, webm.",
    };
  }

  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    return {
      ok: false,
      error: `File is too large. Maximum ${mb} MB for ${type === "IMAGE" ? "images" : "videos"}.`,
    };
  }

  const dir = path.join(process.cwd(), "public", "uploads", practiceId);
  await mkdir(dir, { recursive: true });
  const filename = `${crypto.randomUUID()}.${ext}`;
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()));

  return { ok: true, type, url: `/uploads/${practiceId}/${filename}` };
}
