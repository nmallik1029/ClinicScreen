import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "cs_session";
const MAX_AGE = 60 * 60 * 24 * 7; // 7 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Set a signed session cookie for the given ClinicScreen user id. Route handlers only. */
export function createSession(userId: string) {
  cookies().set(COOKIE, `${userId}.${sign(userId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
}

/** Return the user id from a valid signed session cookie, or null. */
export function getSessionUserId(): string | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const idx = raw.lastIndexOf(".");
  if (idx < 0) return null;
  const userId = raw.slice(0, idx);
  const sig = raw.slice(idx + 1);
  const expected = sign(userId);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  return userId;
}

export function destroySession() {
  cookies().delete(COOKIE);
}
