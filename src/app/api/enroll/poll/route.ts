import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { hashSecret } from "@/lib/enroll";

// A player device polls for its pairing result. Authenticated by the machine
// secret it received from /api/enroll/start. Returns the device id + token once
// an admin has claimed the code.
export async function POST(req: Request) {
  let enrollmentId = "";
  let secret = "";
  try {
    const body = await req.json();
    enrollmentId = String(body.enrollmentId ?? "");
    secret = String(body.secret ?? "");
  } catch {
    /* fall through to validation */
  }
  if (!enrollmentId || !secret) {
    return NextResponse.json({ status: "invalid" }, { status: 400 });
  }

  const e = await prisma.pendingEnrollment.findUnique({ where: { id: enrollmentId } });
  if (!e || e.secretHash !== hashSecret(secret)) {
    return NextResponse.json({ status: "invalid" }, { status: 404 });
  }

  if (e.status === "CLAIMED" && e.deviceId) {
    const device = await prisma.device.findUnique({
      where: { id: e.deviceId },
      select: { token: true },
    });
    if (device?.token) {
      return NextResponse.json({ status: "claimed", deviceId: e.deviceId, token: device.token });
    }
    // Claimed but the screen/token is gone — treat as expired so the device re-pairs.
    return NextResponse.json({ status: "expired" });
  }

  if (e.expiresAt < new Date()) {
    return NextResponse.json({ status: "expired" });
  }

  return NextResponse.json({ status: "pending" });
}
