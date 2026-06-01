import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { expireStalePending } from "@/lib/commands";
import { deviceTokenValid, tokenFromRequest } from "@/lib/device";

// Pending commands for a device (REFRESH only, for now). Authenticated by token.
export async function GET(req: Request, { params }: { params: { deviceId: string } }) {
  if (!(await deviceTokenValid(params.deviceId, tokenFromRequest(req)))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  await expireStalePending({ deviceId: params.deviceId });
  const commands = await prisma.deviceCommand.findMany({
    where: { deviceId: params.deviceId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, commandType: true },
  });
  return NextResponse.json(commands);
}
