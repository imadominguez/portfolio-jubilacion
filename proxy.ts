import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { isAdminRole } from "@/lib/user-role";

const ADMIN_PATH_PREFIXES = [
  "/assets",
  "/strategy",
  "/settings",
  "/portfolio",
] as const;

function isAdminOnlyPath(pathname: string): boolean {
  return ADMIN_PATH_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isAuthRoute = pathname.startsWith("/api/auth");
  const isLoginPage = pathname === "/login";
  const isRegisterPage = pathname === "/register";
  const isStaticAsset =
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.startsWith("/public");

  // El cron no tiene sesión: el route valida CRON_SECRET (ADR-0020).
  const isCronRoute = pathname.startsWith("/api/cron/");

  if (isAuthRoute || isStaticAsset || isCronRoute) {
    return NextResponse.next();
  }

  const session = await auth.api.getSession({ headers: request.headers });

  if (!session && !isLoginPage && !isRegisterPage) {
    const loginUrl = new URL("/login", request.url);
    // Guardamos la ruta pedida para volver a ella después del login.
    if (pathname !== "/") {
      loginUrl.searchParams.set("next", pathname + request.nextUrl.search);
    }
    return NextResponse.redirect(loginUrl);
  }

  if (session && (isLoginPage || isRegisterPage)) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (
    session &&
    isAdminOnlyPath(pathname) &&
    !isAdminRole(session.user.role)
  ) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
