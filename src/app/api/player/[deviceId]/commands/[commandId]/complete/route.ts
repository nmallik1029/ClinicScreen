import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { deviceTokenValid, tokenFromRequest } from "@/lib/device";

// Player marks a command handled. Authenticated by the per-device token.
export async function POST(
  req: Request,
  { params }: { params: { deviceId: string; commandId: string } }
) {
  if (!(await deviceTokenValid(params.deviceId, tokenFromRequest(req)))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await prisma.deviceCommand.updateMany({
    where: { id: params.commandId, deviceId: params.deviceId, status: "PENDING" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
