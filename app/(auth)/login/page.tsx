import { Suspense } from "react";
import { isPublicSignupEnabled } from "@/lib/auth";
import { LoginForm } from "./login-form";

// Sólo rutas internas: evita usar el login como open redirect.
function safeNext(next: string | string[] | undefined): string {
  if (typeof next !== "string") return "/";
  if (!next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return "/";
  }
  return next;
}

type LoginSearchParams = Promise<{ next?: string | string[] }>;

export default function LoginPage({ searchParams }: { searchParams: LoginSearchParams }) {
  return (
    <Suspense>
      <Login searchParams={searchParams} />
    </Suspense>
  );
}

// searchParams es dato de request: el flag de registro se lee después, también
// en request time.
async function Login({ searchParams }: { searchParams: LoginSearchParams }) {
  const { next } = await searchParams;
  return <LoginForm allowSignup={isPublicSignupEnabled()} redirectTo={safeNext(next)} />;
}
