import { NextResponse, type NextRequest } from "next/server";

// Public routes: the test player (device-token auth comes later), the login
// page, and the OAuth callback/login routes. Everything else needs a session.
const PUBLIC = [/^\/player(\/|$)/, /^\/login$/, /^\/auth(\/|$)/];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC.some((re) => re.test(pathname))) return NextResponse.next();

  if (!req.cookies.has("cs_session")) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
