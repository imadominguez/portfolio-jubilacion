import { Info } from "lucide-react";
import type { RealGainsSummary } from "@/lib/real-gains-data";

export function MethodologyNote({ summary }: { summary: RealGainsSummary }) {
  return (
    <div className="rounded-xl border border-border/50 bg-muted/30 px-5 py-4 flex gap-3 animate-fade-up">
      <Info className="size-4 text-muted-foreground/60 shrink-0 mt-0.5" />
      <div className="flex flex-col gap-2 text-xs text-muted-foreground leading-relaxed">
        <p>
          <span className="font-semibold text-foreground">Metodología de cálculo.</span>{" "}
          La <span className="font-semibold">ganancia real en USD</span> (Método A) convierte
          el costo de cada compra a USD usando el CCL del día de la transacción, y el valor
          actual usando el CCL del snapshot. La{" "}
          <span className="font-semibold">ganancia por apreciación</span> (Método B) usa el
          precio USD del subyacente en Yahoo Finance en la fecha de compra vs el precio actual.
          El <span className="font-semibold">impacto CCL</span> es la diferencia A − B: cuánto
          de la ganancia en USD se debe a la variación del tipo de cambio y no a la suba de las
          acciones.
        </p>
        {summary.cclCoverage < 100 && (
          <p>
            <span className="text-warning font-semibold">~</span> El símbolo indica que el CCL
            usado no es exactamente del día de la compra sino del día hábil más cercano (±7 días).
            Para mejorar la cobertura, cargá más fechas de CCL histórico.
          </p>
        )}
        <p className="text-muted-foreground/60">
          Fuentes: precios de acciones de Yahoo Finance · tipo de cambio de dolarapi.com ·
          posiciones del snapshot más reciente importado desde Cocos Capital.
        </p>
      </div>
    </div>
  );
}
