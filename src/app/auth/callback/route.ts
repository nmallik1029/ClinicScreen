import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import { createSession } from "@/lib/session";
import { quickauth, OAUTH_STATE_COOKIE } from "@/lib/quickauth";

function fail(req: NextRequest) {
  return NextResponse.redirect(new URL("/unauthorized", req.url));
}

// quickAuth redirects here with ?code & ?state after the user authorizes.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const savedState = cookies().get(OAUTH_STATE_COOKIE)?.value;
  cookies().delete(OAUTH_STATE_COOKIE);

  if (!code || !state || !savedState || state !== savedState) return fail(req);

  // Exchange the authorization code for an access token (server-to-server).
  const tokenRes = await fetch(`${quickauth.url}/oauth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    cache: "no-store",
    body: JSON.stringify({
      grant_type: "authorization_code",
      code,
      redirect_uri: quickauth.redirectUri,
      client_id: quickauth.clientId,
      client_secret: quickauth.clientSecret,
    }),
  });
  if (!tokenRes.ok) return fail(req);
  const token = (await tokenRes.json()) as { access_token?: string };
  if (!token.access_token) return fail(req);

  // Fetch the user's profile.
  const infoRes = await fetch(`${quickauth.url}/oauth/userinfo`, {
    headers: { Authorization: `Bearer ${token.access_token}` },
    cache: "no-store",
  });
  if (!infoRes.ok) return fail(req);
  const info = (await infoRes.json()) as { email?: string };
  const email = info.email?.toLowerCase();
  if (!email) return fail(req);

  // Link to a provisioned ClinicScreen user (carries role + practice).
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return fail(req);

  createSession(user.id);
  // Keep the access token briefly so first-login onboarding can change the
  // quickAuth password on the user's behalf.
  cookies().set("cs_qa_token", token.access_token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 3600,
  });
  return NextResponse.redirect(new URL("/", req.url));
}
