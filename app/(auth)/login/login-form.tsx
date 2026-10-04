"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { signIn } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TrendingUp, Lock, Mail, AlertCircle } from "lucide-react";

export function LoginForm({
  allowSignup,
  redirectTo,
}: {
  allowSignup: boolean;
  redirectTo: string;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await signIn.email({
      email,
      password,
    });

    setLoading(false);

    if (result.error) {
      setError("Email o contraseña incorrectos.");
      return;
    }

    router.push(redirectTo);
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden bg-background flex items-center justify-center p-4">
      {/* Ambiente Azure Tech */}
      <div className="pointer-events-none absolute inset-0 grid-bg opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute -top-40 left-1/2 size-[36rem] -translate-x-1/2 rounded-full bg-primary/15 blur-3xl"
        aria-hidden
      />
      <div className="glass relative w-full max-w-sm space-y-7 rounded-2xl p-7 shadow-xl animate-fade-up">
        {/* Header */}
        <div className="space-y-3 text-center">
          <div className="flex justify-center">
            <div className="glow-primary flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <TrendingUp className="h-6 w-6" />
            </div>
          </div>
          <div>
            <h1 className="text-gradient text-2xl font-bold tracking-tight">Portfolio Jubilación</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Ingresá tus credenciales para continuar
            </p>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="text-sm font-medium">
              Email
            </Label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                placeholder="admin@portfolio.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="pl-9"
                required
                autoComplete="email"
                autoFocus
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="password" className="text-sm font-medium">
              Contraseña
            </Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="pl-9"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              <AlertCircle className="h-4 w-4 shrink-0" />
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Ingresando..." : "Ingresar"}
          </Button>
        </form>

        {allowSignup && (
          <p className="text-center text-xs text-muted-foreground">
            ¿No tenés cuenta?{" "}
            <Link href="/register" className="underline underline-offset-4 hover:text-foreground transition-colors">
              Registrate
            </Link>
          </p>
        )}
      </div>
    </div>
  );
}
