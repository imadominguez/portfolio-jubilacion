import type { Metadata } from "next";
import { Suspense } from "react";
import { SiteHeader } from "@/components/layout/site-header";
import { StrategyEditor } from "@/components/strategy/strategy-editor";
import { StrategySkeleton } from "@/components/strategy/strategy-skeleton";
import { getActiveStrategy, getStrategyHistory } from "@/app/actions/strategy";

export const metadata: Metadata = {
  title: "Estrategia de inversión",
  description: "Gestioná el system prompt de la estrategia de inversión en CEDEARs.",
};

// El header y la explicación entran al static shell; la estrategia se lee en
// request time (después del chequeo de ADMIN) detrás del skeleton.
export default function StrategyPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Estrategia"
        description="System prompt de la estrategia de inversión"
      />
      <main className="flex-1 px-6 py-8 max-w-4xl w-full mx-auto flex flex-col gap-2">
        <div className="flex flex-col gap-1 mb-2">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Gestión de estrategia
          </p>
          <p className="text-sm text-muted-foreground max-w-lg leading-relaxed">
            Cada cambio crea una versión nueva inmutable. La versión activa se usa como system
            prompt al generar el reporte mensual con Claude.
          </p>
        </div>
        <Suspense fallback={<StrategySkeleton />}>
          <Strategy />
        </Suspense>
      </main>
    </div>
  );
}

async function Strategy() {
  const [active, history] = await Promise.all([getActiveStrategy(), getStrategyHistory()]);
  // StrategyEditor copia el contenido activo a su estado y <Activity> lo
  // conserva entre navegaciones: el key lo vuelve a montar si la versión activa
  // cambió por fuera (otra pestaña, pnpm db:strategy).
  return <StrategyEditor key={active?.id ?? "sin-estrategia"} active={active} history={history} />;
}
