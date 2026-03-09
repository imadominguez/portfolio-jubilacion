"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { fetchAndSaveMarketPrices } from "@/app/actions/market-prices";

interface MarketPricesButtonProps {
  variant?: "default" | "outline" | "ghost" | "secondary";
  size?: "default" | "sm" | "lg" | "icon";
}

export function MarketPricesButton({
  variant = "outline",
  size = "sm",
}: MarketPricesButtonProps) {
  const [isPending, startTransition] = useTransition();

  function handleFetch() {
    startTransition(async () => {
      const result = await fetchAndSaveMarketPrices();
      if (result.success) {
        const msg =
          result.failed.length > 0
            ? `${result.updated} actualizados, fallaron: ${result.failed.join(", ")}`
            : `${result.updated} precios actualizados`;
        toast.success(msg);
      } else {
        toast.error(result.error);
      }
    });
  }

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleFetch}
      disabled={isPending}
      className="gap-1.5"
    >
      <TrendingUp className={`size-3.5 ${isPending ? "animate-pulse" : ""}`} />
      <span>{isPending ? "Actualizando precios…" : "Actualizar precios"}</span>
    </Button>
  );
}
