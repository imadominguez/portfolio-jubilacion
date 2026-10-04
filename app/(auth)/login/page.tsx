import { allowPublicSignup } from "@/lib/auth";
import { LoginForm } from "./login-form";

// El flag ALLOW_PUBLIC_SIGNUP se evalúa por request (no en build).
export const dynamic = "force-dynamic";

// Sólo rutas internas: evita usar el login como open redirect.
function safeNext(next: string | string[] | undefined): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string | string[] }>;
}) {
  const { next } = await searchParams;
  return <LoginForm allowSignup={allowPublicSignup} redirectTo={safeNext(next)} />;
}
