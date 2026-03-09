import { NextRequest, NextResponse } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export function proxy(request: NextRequest) {
  const sessionCookie = getSessionCookie(request);

  if (!sessionCookie) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/",
    "/performance/:path*",
    "/snapshots/:path*",
    "/analysis/:path*",
    "/rebalance/:path*",
    "/transactions/:path*",
    "/retirement/:path*",
    "/assets/:path*",
    "/settings/:path*",
    "/api/export/:path*",
  ],
};
