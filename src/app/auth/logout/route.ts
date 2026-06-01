import { NextResponse, type NextRequest } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST(req: NextRequest) {
  destroySession();
  return NextResponse.redirect(new URL("/", req.url), { status: 303 });
}
