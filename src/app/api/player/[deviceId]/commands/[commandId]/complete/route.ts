import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Player marks a command handled. Unauthenticated for now.
export async function POST(
  _req: Request,
  { params }: { params: { deviceId: string; commandId: string } }
) {
  await prisma.deviceCommand.updateMany({
    where: { id: params.commandId, deviceId: params.deviceId, status: "PENDING" },
    data: { status: "COMPLETED", completedAt: new Date() },
  });
  return NextResponse.json({ ok: true });
}
