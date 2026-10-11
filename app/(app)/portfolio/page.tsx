import { OpportunityAnalyzer } from "@/components/analysis/opportunity-analyzer";
import { Suspense } from "react";
import { ReportHistorial } from "@/components/analysis/report-historial";
import { SignalHistoryTable } from "@/components/analysis/signal-history";
import { getSignalHistory } from "@/app/actions/reports";
import { SiteHeader } from "@/components/layout/site-header";

export const metadata = {
  title: "Oportunidades",
  description: "Revisá el precio y las noticias de cada acción de tu cartera y si es momento de comprar, mantener o vender.",
};

export default function PortfolioPage() {
  // SiteHeader como en el resto de las páginas: trae el botón del sidebar, sin
  // el que en el celular no había forma de navegar desde acá.
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Oportunidades" description="Precio, noticias y señal de cada acción" />
      <OpportunityAnalyzer />
      <Suspense fallback={null}>
        <SignalHistory />
      </Suspense>
      <ReportHistorial />
    </div>
  );
}

// Lee la sesión y los reportes del usuario: va dentro de su propio <Suspense>.
async function SignalHistory() {
  const history = await getSignalHistory();
  return history.reports.length > 0 ? <SignalHistoryTable history={history} /> : null;
}
