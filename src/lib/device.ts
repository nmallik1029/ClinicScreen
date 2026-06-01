import crypto from "crypto";
import { prisma } from "@/lib/prisma";

/** A per-screen secret used to authenticate the player and device APIs. */
export function newDeviceToken(): string {
  return crypto.randomBytes(24).toString("base64url");
}

/** True if the token matches the device's current token. */
export async function deviceTokenValid(deviceId: string, token: string | null): Promise<boolean> {
  if (!token) return false;
  const d = await prisma.device.findUnique({ where: { id: deviceId }, select: { token: true } });
  return !!d?.token && d.token === token;
}

export function tokenFromRequest(req: Request): string | null {
  return new URL(req.url).searchParams.get("t");
}
