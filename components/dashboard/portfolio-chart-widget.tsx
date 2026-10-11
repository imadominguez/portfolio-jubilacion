import { PerformanceChart } from "@/components/performance/performance-chart";
import type { SnapshotPoint } from "@/lib/portfolio-data";

interface PortfolioChartWidgetProps {
  snapshots: SnapshotPoint[];
}

export function PortfolioChartWidget({ snapshots }: PortfolioChartWidgetProps) {
  if (snapshots.length < 2) return null;

  return (
    <section aria-labelledby="evolution-title" className="flex flex-col gap-3">
      <h2 id="evolution-title" className="text-base font-semibold text-foreground">
        Evolución del portfolio
      </h2>
      <div className="rounded-2xl border border-border bg-card p-5">
        <PerformanceChart snapshots={snapshots} />
      </div>
    </section>
  );
}
