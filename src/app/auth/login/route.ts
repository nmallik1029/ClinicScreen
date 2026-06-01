import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import crypto from "crypto";
import { quickauth, OAUTH_STATE_COOKIE } from "@/lib/quickauth";

// Starts the quickAuth OAuth authorization-code flow.
export async function GET() {
  const state = crypto.randomUUID();
  cookies().set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  const url =
    `${quickauth.url}/oauth/authorize` +
    `?response_type=code` +
    `&client_id=${encodeURIComponent(quickauth.clientId)}` +
    `&redirect_uri=${encodeURIComponent(quickauth.redirectUri)}` +
    `&state=${encodeURIComponent(state)}` +
    `&scope=${encodeURIComponent(quickauth.scope)}`;

  return NextResponse.redirect(url);
}
