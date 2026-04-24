import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { SiteHeader } from "@/components/layout/site-header";
import { HoldingsTable } from "@/components/dashboard/holdings-table";
import { AllocationPanel } from "@/components/dashboard/allocation-panel";
import { ExportButtons } from "@/components/export/export-buttons";
import { db } from "@/lib/db";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  const snapshot = await db.portfolioSnapshot.findUnique({
    where: { id },
    select: { snapshotDate: true },
  });
  if (!snapshot) return { title: "Snapshot no encontrado" };
  const date = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(snapshot.snapshotDate));
  return { title: `Snapshot ${date}` };
}

function formatARS(value: number): string {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default async function SnapshotDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const snapshot = await db.portfolioSnapshot.findUnique({
    where: { id },
    include: {
      positions: { orderBy: { positionValue: "desc" } },
    },
  });

  if (!snapshot) notFound();

  const snapshotDate = new Date(snapshot.snapshotDate);
  const formattedDate = new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(snapshotDate);

  const positions = snapshot.positions.map((p) => ({
    ticker: p.ticker,
    instrumentName: p.instrumentName,
    quantity: Number(p.quantity),
    price: Number(p.price),
    positionValue: Number(p.positionValue),
    allocationPct: Number(p.allocationPct) * 100,
  }));

  const totalArs = Number(snapshot.totalValueArs);
  const totalUsd = snapshot.totalValueUsd ? Number(snapshot.totalValueUsd) : null;
  const ccl = snapshot.ccl ? Number(snapshot.ccl) : null;

  const kpis = [
    {
      label: "Valor Total ARS",
      value: formatARS(totalArs),
    },
    {
      label: "Equivalente USD",
      value: totalUsd ? formatUSD(totalUsd) : "—",
    },
    {
      label: "CCL",
      value: ccl
        ? `$ ${new Intl.NumberFormat("es-AR", {
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
          }).format(ccl)}`
        : "—",
    },
    {
      label: "Posiciones",
      value: `${positions.length} activos`,
    },
  ];

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Snapshot"
        description={formattedDate}
        actions={<ExportButtons snapshotId={id} />}
      />

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-10 max-w-6xl w-full mx-auto">
        {/* Back + date header */}
        <section className="animate-fade-up flex flex-col gap-3 sm:gap-4">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-fit -ml-2 gap-2 text-muted-foreground hover:text-foreground text-xs"
          >
            <Link href="/snapshots">
              <ArrowLeft className="size-3.5" data-icon="inline-start" />
              Volver a snapshots
            </Link>
          </Button>

          <div className="flex flex-col gap-1">
            <p className="text-[9px] sm:text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Snapshot del
            </p>
            <p className="text-2xl sm:text-4xl md:text-5xl font-mono font-light tabular-nums tracking-tight text-foreground">
              {formattedDate}
            </p>
            {snapshot.sourceFile && (
              <p className="text-[10px] sm:text-xs text-muted-foreground font-mono mt-1 truncate">
                Archivo: {snapshot.sourceFile}
              </p>
            )}
          </div>
        </section>

        {/* KPI strip */}
        <section
          className="animate-fade-up grid grid-cols-2 gap-3 md:grid-cols-4"
          style={{ animationDelay: "60ms" }}
        >
          {kpis.map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl border border-border bg-card shadow-sm px-3 sm:px-5 py-3 sm:py-4 flex flex-col gap-1.5 sm:gap-2"
            >
              <span className="text-xs sm:text-sm font-semibold text-foreground">
                {label}
              </span>
              <span className="text-base sm:text-xl font-bold font-mono tabular-nums text-foreground leading-none">
                {value}
              </span>
              <div className="flex items-center gap-1.5">
                <span className="size-1.5 sm:size-2 rounded-full bg-emerald-500/50 shrink-0" />
                <span className="text-[10px] sm:text-xs text-muted-foreground">snapshot</span>
              </div>
            </div>
          ))}
        </section>

        <Separator className="opacity-30" />

        {/* Main content */}
        <section className="grid gap-6 sm:gap-8 lg:grid-cols-5">
          <div className="lg:col-span-2 order-2 lg:order-1">
            <AllocationPanel positions={positions} totalArs={totalArs} />
          </div>
          <div className="lg:col-span-3 order-1 lg:order-2">
            <HoldingsTable positions={positions} />
          </div>
        </section>
      </main>
    </div>
  );
}
