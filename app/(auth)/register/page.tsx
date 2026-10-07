import { Suspense } from "react";
import { AuthCardSkeleton } from "@/components/auth/auth-card-skeleton";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { isPublicSignupEnabled } from "@/lib/auth";
import { RegisterForm } from "./register-form";

export default function RegisterPage() {
  return (
    <Suspense fallback={<AuthCardSkeleton />}>
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
