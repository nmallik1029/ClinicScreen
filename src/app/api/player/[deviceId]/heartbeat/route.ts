import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceTokenValid, tokenFromRequest } from "@/lib/device";

// Player check-in. Authenticated by the per-device token.
export async function POST(req: Request, { params }: { params: { deviceId: string } }) {
  if (!(await deviceTokenValid(params.deviceId, tokenFromRequest(req)))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await prisma.device.update({
    where: { id: params.deviceId },
    data: { status: "ONLINE", lastSeenAt: new Date(), softwareVersion: "browser-dev" },
  });
  return NextResponse.json({ ok: true });
}
