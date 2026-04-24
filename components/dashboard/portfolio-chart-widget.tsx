import { PerformanceChart } from "@/components/performance/performance-chart";
import type { SnapshotPoint } from "@/lib/portfolio-data";

interface PortfolioChartWidgetProps {
  snapshots: SnapshotPoint[];
}

export function PortfolioChartWidget({ snapshots }: PortfolioChartWidgetProps) {
  if (snapshots.length < 2) return null;

  return (
    <div className="animate-fade-up" style={{ animationDelay: "100ms" }}>
      <p className="mb-2 sm:mb-3 text-[10px] sm:text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        Evolución del portfolio
      </p>
      <div className="rounded-xl border border-border bg-card shadow-sm p-3 sm:p-5">
        <PerformanceChart snapshots={snapshots} />
      </div>
    </div>
  );
}
