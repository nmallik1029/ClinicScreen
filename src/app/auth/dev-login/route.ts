import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { devLoginEnabled, DEV_LOGIN_EMAIL } from "@/lib/dev-login";

// Local dev bypass: create (or reuse) a superadmin and sign them in. 404s unless
// DEV_LOGIN=1 in a non-production build, so it's inert in any real deployment.
export async function GET() {
  if (!devLoginEnabled()) {
    return new NextResponse("Not found", { status: 404 });
  }

  const user = await prisma.user.upsert({
    where: { email: DEV_LOGIN_EMAIL },
    update: { role: "SUPERADMIN", disabledAt: null },
    create: { email: DEV_LOGIN_EMAIL, name: "Local Dev", role: "SUPERADMIN" },
  });

  createSession(user.id);
  return new NextResponse(null, { status: 307, headers: { Location: "/" } });
}
