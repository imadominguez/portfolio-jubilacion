"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAndSaveAllIndices } from "@/app/actions/indices";

interface IndicesUpdateButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function IndicesUpdateButton({
  variant = "outline",
  size = "sm",
}: IndicesUpdateButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleUpdate() {
    startTransition(async () => {
      const result = await fetchAndSaveAllIndices();
      if (result.success) {
        toast.success(
          `Índices actualizados · IPC ${result.inflacion} puntos · CER ${result.cer} puntos`
        );
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleUpdate}
      disabled={isPending}
      className="gap-1.5"
    >
      <TrendingUp className={`size-3.5 ${isPending ? "animate-pulse" : ""}`} />
      <span>{isPending ? "Actualizando índices…" : "Actualizar índices"}</span>
    </Button>
  );
}
