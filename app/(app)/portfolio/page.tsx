import { PortfolioAnalyzer } from "@/components/analysis/portfolio-analizer";
import { ReportHistorial } from "@/components/analysis/report-historial";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

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