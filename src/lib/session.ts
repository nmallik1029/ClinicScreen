import { cookies } from "next/headers";
import crypto from "crypto";

const COOKIE = "cs_session";
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

function secret() {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set");
  return s;
}

function sign(value: string) {
  return crypto.createHmac("sha256", secret()).update(value).digest("base64url");
}

/** Set a signed, expiring session cookie. Route handlers / server actions only. */
export function createSession(userId: string) {
  const payload = `${userId}.${Date.now()}`;
  cookies().set(COOKIE, `${payload}.${sign(payload)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(MAX_AGE_MS / 1000),
  });
}

/** Verify the cookie signature + age. Returns the userId and when it was issued. */
export function getSession(): { userId: string; issuedAt: number } | null {
  const raw = cookies().get(COOKIE)?.value;
  if (!raw) return null;
  const lastDot = raw.lastIndexOf(".");
  if (lastDot < 0) return null;
  const payload = raw.slice(0, lastDot);
  const sig = raw.slice(lastDot + 1);
  const expected = sign(payload);
  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  const [userId, issuedAtStr] = payload.split(".");
  const issuedAt = Number(issuedAtStr);
  if (!userId || !Number.isFinite(issuedAt)) return null;
  if (Date.now() - issuedAt > MAX_AGE_MS) return null; // expired
  return { userId, issuedAt };
}

export function destroySession() {
  cookies().delete(COOKIE);
}
