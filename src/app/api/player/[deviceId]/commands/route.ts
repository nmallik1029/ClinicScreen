import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Pending commands for a device (REFRESH only, for now). Unauthenticated for now.
export async function GET(_req: Request, { params }: { params: { deviceId: string } }) {
  const commands = await prisma.deviceCommand.findMany({
    where: { deviceId: params.deviceId, status: "PENDING" },
    orderBy: { createdAt: "asc" },
    select: { id: true, commandType: true },
  });
  return NextResponse.json(commands);
}
