import { PortfolioAnalyzer } from "@/components/analysis/portfolio-analizer";
import { ReportHistorial } from "@/components/analysis/report-historial";

export const metadata = {
  title: "Reporte mensual | Portafolio de jubilación",
  description: "Analizá tu tenencia de CEDEARs con IA y obtené la instrucción de inversión del mes.",
};

export default function PortfolioPage() {
  return (
    <>
      <PortfolioAnalyzer />
      <ReportHistorial />
    </>
  );
}