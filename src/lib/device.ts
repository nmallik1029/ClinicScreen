import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** A per-screen secret used to authenticate the player and device APIs. */
export function newDeviceToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** Constant-time string compare (avoids leaking length/content via timing). */
function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

/** True if the token matches the device's current token. */
export async function deviceTokenValid(deviceId: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const d = await prisma.device.findUnique({ where: { id: deviceId }, select: { token: true } });
  return !!d?.token && safeEqual(d.token, token);
}

export function tokenFromRequest(req: Request): string | null {
  return new URL(req.url).searchParams.get("t");
}
