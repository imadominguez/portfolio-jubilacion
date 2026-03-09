"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAndSaveCCL } from "@/app/actions/exchange-rate";

interface CclUpdateButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
  showLabel?: boolean;
}

export function CclUpdateButton({
  variant = "outline",
  size = "sm",
  showLabel = true,
}: CclUpdateButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleUpdate() {
    startTransition(async () => {
      const result = await fetchAndSaveCCL();
      if (result.success) {
        const formatted = new Intl.NumberFormat("es-AR", {
          style: "currency",
          currency: "ARS",
          minimumFractionDigits: 0,
          maximumFractionDigits: 2,
        }).format(result.ccl);
        toast.success(
          result.alreadyExisted
            ? `CCL actualizado: ${formatted}`
            : `CCL guardado: ${formatted} (${result.date})`
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
      <RefreshCw className={`size-3.5 ${isPending ? "animate-spin" : ""}`} />
      {showLabel && <span>{isPending ? "Actualizando…" : "Actualizar CCL"}</span>}
    </Button>
  );
}
