import { allowPublicSignup } from "@/lib/auth";
import { LoginForm } from "./login-form";

// El flag ALLOW_PUBLIC_SIGNUP se evalúa por request (no en build).
export const dynamic = "force-dynamic";

export default function LoginPage() {
  return <LoginForm allowSignup={allowPublicSignup} />;
}
