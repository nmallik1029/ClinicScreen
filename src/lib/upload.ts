import { writeFile, mkdir, unlink } from "fs/promises";
import path from "path";
import crypto from "crypto";
import { S3Client, PutObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";
import type { MediaType } from "@prisma/client";

const IMAGE_EXT = new Set(["jpg", "jpeg", "png", "webp"]);
const VIDEO_EXT = new Set(["mp4", "webm"]);
const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

const MIME: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  mp4: "video/mp4",
  webm: "video/webm",
};

export type MediaFormState = { error?: string; ok?: boolean };

type SaveResult = { ok: true; type: MediaType; url: string } | { ok: false; error: string };

// --- R2 (Cloudflare) storage, used when configured; local disk otherwise. ---
function r2Config() {
  const accountId = process.env.R2_ACCOUNT_ID ?? "";
  const accessKeyId = process.env.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = process.env.R2_BUCKET ?? "";
  const publicBaseUrl = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  const enabled = !!(accountId && accessKeyId && secretAccessKey && bucket && publicBaseUrl);
  return { accountId, accessKeyId, secretAccessKey, bucket, publicBaseUrl, enabled };
}

let _r2: S3Client | null = null;
function r2Client() {
  if (_r2) return _r2;
  const c = r2Config();
  _r2 = new S3Client({
    region: "auto",
    endpoint: `https://${c.accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: c.accessKeyId, secretAccessKey: c.secretAccessKey },
    forcePathStyle: true,
  });
  return _r2;
}

/**
 * Validate and store an uploaded media file. Uses Cloudflare R2 when configured
 * (R2_* env vars), otherwise writes to public/uploads for local dev. Returns the
 * public URL the dashboard and player can serve.
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

  const filename = `${crypto.randomUUID()}.${ext}`;
  const key = `uploads/${practiceId}/${filename}`;
  const bytes = Buffer.from(await file.arrayBuffer());

  const r2 = r2Config();
  if (r2.enabled) {
    await r2Client().send(
      new PutObjectCommand({
        Bucket: r2.bucket,
        Key: key,
        Body: bytes,
        ContentType: MIME[ext],
      })
    );
    return { ok: true, type, url: `${r2.publicBaseUrl}/${key}` };
  }

  const dir = path.join(process.cwd(), "public", "uploads", practiceId);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, filename), bytes);
  return { ok: true, type, url: `/${key}` };
}

/** Remove a stored file (R2 or local). No-ops for external/seed URLs. */
export async function deleteUploadedFile(url: string): Promise<void> {
  const r2 = r2Config();
  if (r2.enabled && r2.publicBaseUrl && url.startsWith(r2.publicBaseUrl + "/")) {
    const key = url.slice(r2.publicBaseUrl.length + 1);
    await r2Client()
      .send(new DeleteObjectCommand({ Bucket: r2.bucket, Key: key }))
      .catch(() => {});
    return;
  }
  if (url.startsWith("/uploads/")) {
    await unlink(path.join(process.cwd(), "public", url)).catch(() => {});
  }
}
