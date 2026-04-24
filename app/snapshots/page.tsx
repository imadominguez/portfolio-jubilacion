import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, ChevronRight } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { SiteHeader } from "@/components/layout/site-header";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { getAllSnapshotPoints } from "@/lib/portfolio-data";

export const metadata: Metadata = { title: "Snapshots" };

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

export default async function SnapshotsPage() {
  const snapshots = await getAllSnapshotPoints();
  const sorted = [...snapshots].reverse();

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Snapshots" description="Historial de importaciones" actions={<ImportButton />} />

      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10 flex flex-col gap-6 sm:gap-8 max-w-6xl w-full mx-auto">
        {/* Top row */}
        <div className="animate-fade-up flex items-center justify-between gap-4">
          <div className="flex flex-col gap-0.5">
            <p className="text-[9px] sm:text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
              Total registrados
            </p>
            <p className="text-2xl sm:text-3xl font-mono font-light tabular-nums text-foreground">
              {snapshots.length}
            </p>
          </div>
          <ImportButton />
        </div>

        <Separator className="opacity-30" />

        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-4 py-20 text-center">
            <CalendarDays className="size-8 text-muted-foreground/40" />
            <div className="flex flex-col gap-1.5 max-w-xs">
              <p className="text-sm font-medium text-foreground">Sin snapshots</p>
              <p className="text-xs text-muted-foreground leading-relaxed">
                Aún no importaste ningún snapshot. Usá el botón "Importar CSV"
                para registrar el primer estado de tu portfolio.
              </p>
            </div>
          </div>
        ) : (
          <section
            className="animate-fade-up flex flex-col gap-3"
            style={{ animationDelay: "80ms" }}
          >
            <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
              Registros
            </p>
            <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
              <div className="divide-y divide-border">
                {sorted.map((s, i) => {
                  const prev = snapshots[snapshots.length - 2 - i];
                  const change =
                    prev
                      ? ((s.totalValueArs - prev.totalValueArs) /
                          prev.totalValueArs) *
                        100
                      : null;
                  const isPos = change !== null && change >= 0;

                  return (
                    <Link
                      key={s.id}
                      href={`/snapshots/${s.id}`}
                      className="px-3 sm:px-5 py-3 sm:py-4 flex items-center justify-between gap-2 sm:gap-4 hover:bg-muted/50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 sm:gap-4 min-w-0">
                        <div className="size-2 rounded-full bg-emerald-500/50 shrink-0" />
                        <div className="flex flex-col gap-0.5 min-w-0">
                          <span className="text-xs sm:text-sm font-mono text-foreground">
                            {new Intl.DateTimeFormat("es-AR", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                            }).format(new Date(s.snapshotDate))}
                          </span>
                          <span className="text-[10px] sm:text-[11px] text-muted-foreground">
                            {s.positionCount} pos.
                            {s.ccl ? ` · $${s.ccl.toFixed(0)}` : ""}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 sm:gap-4 shrink-0">
                        <div className="text-right hidden xs:flex flex-col gap-0.5">
                          <span className="text-xs sm:text-sm font-mono tabular-nums text-foreground">
                            {formatARS(s.totalValueArs)}
                          </span>
                          {s.totalValueUsd && (
                            <span className="text-[10px] sm:text-[11px] font-mono text-muted-foreground hidden sm:block">
                              {formatUSD(s.totalValueUsd)}
                            </span>
                          )}
                        </div>

                        {change !== null && (
                          <Badge
                            variant="secondary"
                            className={`font-mono text-[10px] sm:text-[11px] tabular-nums ${
                              isPos ? "text-emerald-500" : "text-destructive"
                            }`}
                          >
                            {isPos ? "+" : ""}
                            {change.toFixed(2)}%
                          </Badge>
                        )}

                        <ChevronRight className="size-3 sm:size-3.5 text-muted-foreground/40 group-hover:text-muted-foreground transition-colors" />
                      </div>
                    </Link>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Import hint when no data */}
        {snapshots.length === 0 && (
          <div className="rounded-xl border border-dashed border-border bg-card/50 shadow-sm px-6 py-5 flex items-center justify-between gap-4">
            <div className="flex flex-col gap-0.5">
              <p className="text-sm font-medium text-foreground">
                Primer snapshot
              </p>
              <p className="text-xs text-muted-foreground">
                Exportá tu cartera desde Cocos Capital e importala para comenzar.
              </p>
            </div>
            <ImportButton />
          </div>
        )}
      </main>
    </div>
  );
}
