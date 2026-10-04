import { Suspense } from "react";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isPublicSignupEnabled } from "@/lib/auth";
import { RegisterForm } from "./register-form";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

export default function RegisterPage() {
  return (
    <Suspense>
      <RegisterGate />
    </Suspense>
  );
}

// ALLOW_PUBLIC_SIGNUP se evalúa por request, no en el build.
async function RegisterGate() {
  await connection();
  if (!isPublicSignupEnabled()) {
    redirect("/login");
  }
  return <RegisterForm />;
}
