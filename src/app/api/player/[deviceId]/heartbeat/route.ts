import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Player check-in. Unauthenticated for now (device-token auth comes later).
export async function POST(_req: Request, { params }: { params: { deviceId: string } }) {
  try {
    await prisma.device.update({
      where: { id: params.deviceId },
      data: { status: "ONLINE", lastSeenAt: new Date(), softwareVersion: "browser-dev" },
    });
  } catch {
    // Unknown device id — ignore so the player keeps running.
  }
  return NextResponse.json({ ok: true });
}
