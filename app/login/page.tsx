"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  async function handleGoogleSignIn() {
    setLoading(true);
    await authClient.signIn.social({
      provider: "google",
      callbackURL: "/",
    });
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background subtle grid */}
      <div
        className="fixed inset-0 opacity-[0.03] dark:opacity-[0.06] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(var(--foreground) 1px, transparent 1px), linear-gradient(90deg, var(--foreground) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div className="bg-card border border-border rounded-2xl shadow-xl overflow-hidden">
          {/* Header strip */}
          <div className="h-1 w-full bg-linear-to-r from-transparent via-primary/40 to-transparent" />

          <div className="px-8 pt-10 pb-10 flex flex-col items-center gap-8">
            {/* Logo mark */}
            <div className="flex flex-col items-center gap-3">
              <div className="size-12 rounded-xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
                <span className="text-lg font-black text-primary-foreground tracking-tight">
                  PJ
                </span>
              </div>
              <div className="text-center">
                <h1 className="text-xl font-bold text-foreground tracking-tight">
                  Portfolio Jubilación
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  Tu dashboard personal de inversiones
                </p>
              </div>
            </div>

            {/* Divider */}
            <div className="w-full h-px bg-border" />

            {/* Sign in section */}
            <div className="w-full flex flex-col items-center gap-4">
              <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground/60">
                Acceso seguro
              </p>

              <button
                onClick={handleGoogleSignIn}
                disabled={loading}
                className="group w-full flex items-center justify-center gap-3 px-5 py-3 rounded-xl bg-secondary hover:bg-secondary/80 border border-border hover:border-border/60 text-secondary-foreground font-medium text-sm transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow active:scale-[0.98]"
              >
                {loading ? (
                  <span className="size-4 rounded-full border-2 border-muted-foreground/30 border-t-muted-foreground animate-spin" />
                ) : (
                  <GoogleIcon />
                )}
                {loading ? "Conectando..." : "Continuar con Google"}
              </button>
            </div>

            {/* Footer note */}
            <p className="text-[11px] text-muted-foreground/40 text-center leading-relaxed">
              Acceso exclusivo para el propietario
              <br />
              del portfolio
            </p>
          </div>
        </div>

        {/* Subtle glow */}
        <div className="absolute -inset-px rounded-2xl bg-linear-to-b from-primary/5 to-transparent pointer-events-none" />
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg
      className="size-4 shrink-0"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        fill="#FBBC05"
      />
      <path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        fill="#EA4335"
      />
    </svg>
  );
}
