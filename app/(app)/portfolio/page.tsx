import { OpportunityAnalyzer } from "@/components/analysis/opportunity-analyzer";
import { ReportHistorial } from "@/components/analysis/report-historial";

export const metadata = {
  title: "Oportunidades",
  description: "Revisá el precio y las noticias de cada acción de tu cartera y si es momento de comprar, mantener o vender.",
};

export default function PortfolioPage() {
  return (
    <>
      <OpportunityAnalyzer />
      <ReportHistorial />
    </>
  );
}
