import { redirect } from "next/navigation";
import { allowPublicSignup } from "@/lib/auth";
import { RegisterForm } from "./register-form";

// El flag ALLOW_PUBLIC_SIGNUP se evalúa por request (no en build).
export const dynamic = "force-dynamic";

export default function RegisterPage() {
  if (!allowPublicSignup) {
    redirect("/login");
  }
  return <RegisterForm />;
}
