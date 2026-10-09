"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { authClient } from "@/lib/auth-client";

// Mínimo de Better Auth (emailAndPassword.minPasswordLength por defecto).
const MIN_LENGTH = 8;

// Better Auth responde con códigos en inglés; acá van en castellano.
const ERRORS: Record<string, string> = {
  INVALID_PASSWORD: "La contraseña actual no es correcta.",
  PASSWORD_TOO_SHORT: `La contraseña nueva tiene que tener al menos ${MIN_LENGTH} caracteres.`,
  PASSWORD_TOO_LONG: "La contraseña nueva es demasiado larga.",
};

export function ChangePasswordDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function reset() {
    setCurrent("");
    setNext("");
    setConfirm("");
    setError(null);
  }

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (next.length < MIN_LENGTH) return setError(ERRORS.PASSWORD_TOO_SHORT);
    if (next !== confirm) return setError("Las contraseñas nuevas no coinciden.");
    if (next === current) return setError("La contraseña nueva tiene que ser distinta de la actual.");

    startTransition(async () => {
      const { error: err } = await authClient.changePassword({
        currentPassword: current,
        newPassword: next,
        // Si alguien más tenía la contraseña, sus sesiones se cierran.
        revokeOtherSessions: true,
      });
      if (err) {
        setError((err.code && ERRORS[err.code]) ?? "No se pudo cambiar la contraseña. Probá de nuevo.");
        return;
      }
      toast.success("Contraseña cambiada");
      reset();
      onOpenChange(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        // Con <Activity> el estado sobrevive a la navegación: cada apertura arranca vacía.
        if (!value) reset();
        onOpenChange(value);
      }}
    >
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Cambiar contraseña</DialogTitle>
          <DialogDescription>
            Se cierran las sesiones abiertas en otros dispositivos; esta queda abierta.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="current-password">Contraseña actual</Label>
            <Input
              id="current-password"
              type="password"
              autoComplete="current-password"
              required
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="new-password">Contraseña nueva</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              required
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
            <span className="text-[11px] text-muted-foreground">Al menos {MIN_LENGTH} caracteres.</span>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="confirm-password">Repetí la contraseña nueva</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending && <Spinner />}
              Cambiar contraseña
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
