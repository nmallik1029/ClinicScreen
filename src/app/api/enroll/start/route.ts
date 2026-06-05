import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  newEnrollmentCode,
  newEnrollmentSecret,
  hashSecret,
  ENROLLMENT_TTL_MS,
} from "@/lib/enroll";
import { rateLimit, clientIp } from "@/lib/rate-limit";

// A player device starts a pairing request. Public (no auth — the device has no
// credentials yet); it gets a code to show on the TV plus a machine secret it
// keeps to poll for the result.
export async function POST(req: Request) {
  // This is unauthenticated and writes a row, so throttle per IP to prevent spam.
  if (!rateLimit(`enroll:start:${clientIp(req)}`, 10, 10 * 60 * 1000)) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  let deviceName: string | null = null;
  try {
    const body = await req.json();
    if (body && typeof body.name === "string") deviceName = body.name.slice(0, 80);
  } catch {
    /* no body is fine */
  }

  // Opportunistic cleanup of expired, unclaimed rows.
  prisma.pendingEnrollment
    .deleteMany({ where: { status: "PENDING", expiresAt: { lt: new Date() } } })
    .catch(() => {});

  const secret = newEnrollmentSecret();
  const secretHash = hashSecret(secret);
  const expiresAt = new Date(Date.now() + ENROLLMENT_TTL_MS);

  // Generate a unique code, retrying on the rare collision.
  let enrollment = null;
  for (let attempt = 0; attempt < 5 && !enrollment; attempt++) {
    const code = newEnrollmentCode();
    try {
      enrollment = await prisma.pendingEnrollment.create({
        data: { code, secretHash, deviceName, status: "PENDING", expiresAt },
      });
    } catch {
      // Unique collision on `code` — try another.
    }
  }
  if (!enrollment) {
    return NextResponse.json({ error: "could_not_allocate_code" }, { status: 503 });
  }

  return NextResponse.json({
    enrollmentId: enrollment.id,
    code: enrollment.code,
    secret,
    expiresInMs: ENROLLMENT_TTL_MS,
  });
}
