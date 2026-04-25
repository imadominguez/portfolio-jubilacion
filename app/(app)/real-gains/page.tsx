import type { Metadata } from "next";
import {
  TrendingUp,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Info,
  BarChart3,
  AlertTriangle,
  ExternalLink,
} from "lucide-react";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { SiteHeader } from "@/components/layout/site-header";
import { RealGainsWizard } from "@/components/real-gains/real-gains-wizard";
import { RealGainsUpdateButton } from "@/components/real-gains/real-gains-update-button";
import {
  getDataReadiness,
  calculateRealGains,
  type RealGainsSummary,
} from "@/lib/real-gains-data";

export const metadata: Metadata = { title: "Ganancia Real en USD" };

// ---------------------------------------------------------------------------
// Helpers de formato
// ---------------------------------------------------------------------------

function fmtARS(v: number) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtUSD(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

function fmtPct(v: number | null) {
  if (v === null) return "—";
  return `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
}

function signColor(v: number | null) {
  if (v === null) return "text-foreground";
  return v >= 0 ? "text-emerald-500" : "text-destructive";
}

// ---------------------------------------------------------------------------
// Componente de KPI card
// ---------------------------------------------------------------------------

function KpiCard({
  label,
  sub,
  value,
  pct,
  positive,
  icon: Icon,
  delay,
}: {
  label: string;
  sub: string;
  value: string;
  pct?: string | null;
  positive: boolean | null;
  icon?: React.ElementType;
  delay?: number;
}) {
  const valueColor =
    positive === true
      ? "text-emerald-500"
      : positive === false
        ? "text-destructive"
        : "text-foreground";

  return (
    <div
      className="rounded-xl border border-border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 animate-fade-up"
      style={{ animationDelay: delay ? `${delay}ms` : undefined }}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{sub}</span>
        </div>
        {Icon && <Icon className="size-4 text-muted-foreground/40 shrink-0 mt-0.5" />}
      </div>
      <div className="flex flex-col gap-1">
        <span className={`text-2xl font-bold font-mono tabular-nums leading-none ${valueColor}`}>
          {value}
        </span>
        {pct !== undefined && pct !== null && (
          <span className={`text-xs font-mono tabular-nums ${valueColor}`}>{pct}</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <span
          className={`size-2 rounded-full shrink-0 ${positive === true
            ? "bg-emerald-500"
            : positive === false
              ? "bg-destructive"
              : "bg-muted-foreground/30"
            }`}
        />
        <span className="text-xs text-muted-foreground">
          {positive === true ? "ganancia" : positive === false ? "pérdida" : "neutro"}
        </span>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Barra de desglose
// ---------------------------------------------------------------------------

function BreakdownBar({ summary }: { summary: RealGainsSummary }) {
  const { totalGainUsdAppreciation, totalGainUsdCclImpact, totalGainUsdReal } = summary;

  if (totalGainUsdReal === null || totalGainUsdAppreciation === null) return null;

  const total = Math.abs(totalGainUsdReal) || 1;
  const appPct = Math.abs(totalGainUsdAppreciation) / total;
  const cclPct = Math.abs(totalGainUsdCclImpact ?? 0) / total;

  const appIsPositive = (totalGainUsdAppreciation ?? 0) >= 0;
  const cclIsPositive = (totalGainUsdCclImpact ?? 0) >= 0;

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4 animate-fade-up">
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs font-semibold text-foreground">
          Desglose de la ganancia en USD
        </p>
        <p className="text-xs text-muted-foreground">
          Total:{" "}
          <span className={`font-mono font-semibold ${signColor(totalGainUsdReal)}`}>
            {fmtUSD(totalGainUsdReal)}
          </span>
        </p>
      </div>

      {/* Barra */}
      <div className="flex h-7 rounded-lg overflow-hidden gap-px">
        <div
          className={`flex items-center justify-center text-[10px] font-semibold text-white transition-all ${appIsPositive ? "bg-emerald-500" : "bg-amber-500"
            }`}
          style={{ width: `${(appPct * 100).toFixed(1)}%`, minWidth: appPct > 0 ? "2px" : "0" }}
          title={`Apreciación acciones: ${fmtUSD(totalGainUsdAppreciation)}`}
        >
          {appPct > 0.15 && `${(appPct * 100).toFixed(0)}%`}
        </div>
        <div
          className={`flex items-center justify-center text-[10px] font-semibold text-white transition-all ${cclIsPositive ? "bg-blue-500" : "bg-destructive"
            }`}
          style={{
            width: `${(cclPct * 100).toFixed(1)}%`,
            minWidth: cclPct > 0 ? "2px" : "0",
          }}
          title={`Impacto CCL: ${fmtUSD(totalGainUsdCclImpact ?? 0)}`}
        >
          {cclPct > 0.15 && `${(cclPct * 100).toFixed(0)}%`}
        </div>
      </div>

      {/* Leyenda */}
      <div className="grid grid-cols-2 gap-3">
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2.5 rounded-full shrink-0 ${appIsPositive ? "bg-emerald-500" : "bg-amber-500"}`}
          />
          <div className="flex flex-col gap-0">
            <span className="text-xs font-medium text-foreground">Apreciación acciones</span>
            <span className={`text-xs font-mono tabular-nums ${signColor(totalGainUsdAppreciation)}`}>
              {fmtUSD(totalGainUsdAppreciation)} ({fmtPct(summary.totalGainPctUsdAppreciation)})
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <span
            className={`size-2.5 rounded-full shrink-0 ${cclIsPositive ? "bg-blue-500" : "bg-destructive"}`}
          />
          <div className="flex flex-col gap-0">
            <span className="text-xs font-medium text-foreground">Impacto CCL</span>
            <span
              className={`text-xs font-mono tabular-nums ${signColor(totalGainUsdCclImpact)}`}
            >
              {fmtUSD(totalGainUsdCclImpact ?? 0)}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tabla de posiciones
// ---------------------------------------------------------------------------

function PositionsTable({ summary }: { summary: RealGainsSummary }) {
  const hasStockData = summary.positions.some((p) => p.stockPriceAvailable);
  const incompletePositions = summary.positions.filter((p) => p.missingReason !== null);

  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden animate-fade-up">
      <Table>
        <TableHeader>
          <TableRow className="border-border hover:bg-transparent bg-muted/40">
            <TableHead className="pl-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9">
              Ticker
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              Costo ARS
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              Costo USD
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              Valor USD actual
            </TableHead>
            <TableHead className="text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              Gan. USD real
            </TableHead>
            {hasStockData && (
              <>
                <TableHead className="hidden xl:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Apreciación
                </TableHead>
                <TableHead className="hidden xl:table-cell text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
                  Impacto CCL
                </TableHead>
              </>
            )}
            <TableHead className="pr-4 text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 text-right h-9">
              % ARS
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {summary.positions.map((pos, i) => (
            <TableRow
              key={pos.ticker}
              className="border-border/60 hover:bg-muted/30 transition-colors animate-fade-up"
              style={{ animationDelay: `${i * 30}ms` }}
            >
              <TableCell className="pl-4 py-3">
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-bold font-mono text-foreground">
                    {pos.ticker}
                  </span>
                  {pos.underlyingTicker && (
                    <span className="text-[11px] text-muted-foreground">
                      {pos.underlyingTicker}
                    </span>
                  )}
                </div>
              </TableCell>
              <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">
                {fmtARS(pos.costArs)}
              </TableCell>
              <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-muted-foreground">
                {pos.costUsdCcl !== null ? fmtUSD(pos.costUsdCcl) : "—"}
                {pos.cclApproximate && pos.costUsdCcl !== null && (
                  <span className="ml-1 text-[10px] text-amber-500">~</span>
                )}
              </TableCell>
              <TableCell className="py-3 text-right text-xs font-mono tabular-nums text-foreground">
                {pos.valueUsdCcl !== null ? fmtUSD(pos.valueUsdCcl) : "—"}
              </TableCell>
              <TableCell className="py-3 text-right">
                <div className="flex flex-col items-end gap-0.5">
                  <span
                    className={`text-sm font-mono font-semibold tabular-nums ${signColor(pos.gainUsdReal)}`}
                  >
                    {pos.gainUsdReal !== null ? fmtUSD(pos.gainUsdReal) : "—"}
                  </span>
                  {pos.gainPctUsdReal !== null && (
                    <span
                      className={`text-[11px] font-mono tabular-nums ${signColor(pos.gainPctUsdReal)}`}
                    >
                      {fmtPct(pos.gainPctUsdReal)}
                    </span>
                  )}
                </div>
              </TableCell>
              {hasStockData && (
                <>
                  <TableCell className="hidden xl:table-cell py-3 text-right">
                    {pos.gainUsdAppreciation !== null ? (
                      <div className="flex flex-col items-end gap-0.5">
                        <span
                          className={`text-xs font-mono tabular-nums ${signColor(pos.gainUsdAppreciation)}`}
                        >
                          {fmtUSD(pos.gainUsdAppreciation)}
                        </span>
                        {pos.gainPctUsdAppreciation !== null && (
                          <span
                            className={`text-[10px] font-mono tabular-nums ${signColor(pos.gainPctUsdAppreciation)}`}
                          >
                            {fmtPct(pos.gainPctUsdAppreciation)}
                          </span>
                        )}
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                  <TableCell className="hidden xl:table-cell py-3 text-right">
                    {pos.gainUsdCclImpact !== null ? (
                      <span
                        className={`text-xs font-mono tabular-nums ${signColor(pos.gainUsdCclImpact)}`}
                      >
                        {fmtUSD(pos.gainUsdCclImpact)}
                      </span>
                    ) : (
                      <span className="text-xs text-muted-foreground/40">—</span>
                    )}
                  </TableCell>
                </>
              )}
              <TableCell className="pr-4 py-3 text-right">
                <span
                  className={`text-sm font-mono font-semibold tabular-nums ${signColor(pos.gainPctArs)}`}
                >
                  {fmtPct(pos.gainPctArs)}
                </span>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>

      {/* Footer con totales */}
      <div className="border-t border-border bg-muted/20 px-4 py-3 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span>
            Cobertura:{" "}
            <span className="font-semibold text-foreground">
              {summary.positionsWithFullData}/{summary.positionsTotal}
            </span>{" "}
            posiciones con datos completos
          </span>
          <span>
            CCL:{" "}
            <span className="font-semibold text-foreground">
              {summary.cclCoverage.toFixed(0)}%
            </span>{" "}
            de transacciones
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs font-mono tabular-nums">
          <span className="text-muted-foreground">Total USD real:</span>
          <span
            className={`font-bold text-sm ${signColor(summary.totalGainUsdReal)}`}
          >
            {summary.totalGainUsdReal !== null ? fmtUSD(summary.totalGainUsdReal) : "—"}
          </span>
        </div>
      </div>

      {/* Panel de diagnóstico para posiciones incompletas */}
      {incompletePositions.length > 0 && (
        <div className="border-t border-amber-500/20 bg-amber-500/5 px-5 py-4 flex flex-col gap-3">
          <div className="flex items-center gap-2">
            <AlertTriangle className="size-3.5 text-amber-500 shrink-0" />
            <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">
              {incompletePositions.length}{" "}
              {incompletePositions.length === 1 ? "posición sin" : "posiciones sin"} datos
              completos — no se incluyen en apreciación ni impacto CCL
            </span>
          </div>
          <div className="flex flex-col gap-2">
            {incompletePositions.map((pos) => (
              <div key={pos.ticker} className="flex items-start gap-3 pl-1">
                <span className="text-xs font-bold font-mono text-foreground w-16 shrink-0 mt-0.5">
                  {pos.ticker}
                </span>
                <div className="flex flex-col gap-0.5 min-w-0">
                  <span className="text-xs text-muted-foreground leading-relaxed">
                    {pos.missingReason}
                  </span>
                  {pos.missingReason?.includes("underlyingTicker") && (
                    <a
                      href="/assets"
                      className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline w-fit"
                    >
                      Configurar en Assets
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                  {pos.missingReason?.includes("wizard") && (
                    <span className="text-[11px] text-amber-600 dark:text-amber-400">
                      Usá el botón &ldquo;Actualizar datos&rdquo; del header para recargar precios
                    </span>
                  )}
                  {pos.missingReason?.includes("Assets") && !pos.missingReason?.includes("underlyingTicker") && (
                    <a
                      href="/assets"
                      className="inline-flex items-center gap-1 text-[11px] text-amber-600 dark:text-amber-400 hover:underline w-fit"
                    >
                      Actualizar precios en Assets
                      <ExternalLink className="size-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Nota metodológica
// ---------------------------------------------------------------------------

function MethodologyNote({ summary }: { summary: RealGainsSummary }) {
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
            <span className="text-amber-500 font-semibold">~</span> El símbolo indica que el CCL
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

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default async function RealGainsPage() {
  const [readiness, summary] = await Promise.all([
    getDataReadiness(),
    calculateRealGains(),
  ]);

  const hasEnoughData =
    readiness.hasSnapshot &&
    readiness.hasTransactions &&
    readiness.hasCclHistory > 0;

  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Ganancia Real"
        description="Desglose en USD · CCL · Apreciación"
        actions={summary ? <RealGainsUpdateButton /> : undefined}
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-6 max-w-6xl w-full mx-auto">
        {/* Intro */}
        <div className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Análisis avanzado
          </p>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Cuánto ganaste realmente en dólares, separando lo que subieron las acciones
            en USD de lo que aportó (o costó) la variación del tipo de cambio CCL.
          </p>
        </div>

        {/* Avisos de prerequisitos faltantes */}
        {!readiness.hasSnapshot && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-sm text-amber-700 dark:text-amber-400">
            Importá al menos un snapshot desde el Dashboard para comenzar.
          </div>
        )}
        {!readiness.hasTransactions && readiness.hasSnapshot && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 px-5 py-4 text-sm text-amber-700 dark:text-amber-400">
            Registrá tus transacciones de compra en la página de Transacciones
            para calcular el costo en USD.
          </div>
        )}

        {/* Gestión de datos históricos — siempre visible */}
        {readiness.hasSnapshot && readiness.hasTransactions && (
          <RealGainsWizard readiness={readiness} />
        )}

        {/* Análisis completo */}
        {summary && summary.positions.length > 0 ? (
          <>
            <Separator className="opacity-30" />

            {/* KPIs */}
            <section className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <KpiCard
                label="Ganancia en ARS"
                sub="valor actual vs costo total"
                value={fmtARS(summary.totalGainArs)}
                pct={fmtPct(summary.totalGainPctArs)}
                positive={summary.totalGainArs >= 0 ? true : false}
                icon={BarChart3}
                delay={0}
              />
              <KpiCard
                label="Ganancia USD real"
                sub="conversión por CCL histórico"
                value={summary.totalGainUsdReal !== null ? fmtUSD(summary.totalGainUsdReal) : "—"}
                pct={
                  summary.totalGainPctUsdReal !== null
                    ? fmtPct(summary.totalGainPctUsdReal)
                    : null
                }
                positive={
                  summary.totalGainUsdReal !== null
                    ? summary.totalGainUsdReal >= 0
                    : null
                }
                icon={DollarSign}
                delay={60}
              />
              <KpiCard
                label="Apreciación acciones"
                sub="suba del subyacente en USD"
                value={
                  summary.totalGainUsdAppreciation !== null
                    ? fmtUSD(summary.totalGainUsdAppreciation)
                    : "—"
                }
                pct={
                  summary.totalGainPctUsdAppreciation !== null
                    ? fmtPct(summary.totalGainPctUsdAppreciation)
                    : null
                }
                positive={
                  summary.totalGainUsdAppreciation !== null
                    ? summary.totalGainUsdAppreciation >= 0
                    : null
                }
                icon={TrendingUp}
                delay={120}
              />
              <KpiCard
                label="Impacto CCL"
                sub={
                  (summary.totalGainUsdCclImpact ?? 0) < 0
                    ? "CCL diluyó ganancias"
                    : "CCL aportó ganancias"
                }
                value={
                  summary.totalGainUsdCclImpact !== null
                    ? fmtUSD(summary.totalGainUsdCclImpact)
                    : "—"
                }
                positive={
                  summary.totalGainUsdCclImpact !== null
                    ? summary.totalGainUsdCclImpact >= 0
                    : null
                }
                icon={
                  (summary.totalGainUsdCclImpact ?? 0) >= 0
                    ? ArrowUpRight
                    : ArrowDownRight
                }
                delay={180}
              />
            </section>

            <Separator className="opacity-30" />

            {/* Barra de desglose */}
            {summary.totalGainUsdAppreciation !== null && (
              <BreakdownBar summary={summary} />
            )}

            {/* Tabla de posiciones */}
            <div className="flex flex-col gap-3">
              <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
                Detalle por posición
              </p>
              <PositionsTable summary={summary} />
            </div>

            {/* Nota metodológica */}
            <MethodologyNote summary={summary} />
          </>
        ) : (
          hasEnoughData && (
            <div className="flex flex-col items-center justify-center gap-3 py-24 text-center">
              <div className="size-12 rounded-full bg-muted flex items-center justify-center">
                <TrendingUp className="size-6 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-foreground">Sin posiciones para analizar</p>
              <p className="text-xs text-muted-foreground max-w-xs">
                Las posiciones del snapshot no coinciden con las transacciones registradas.
                Verificá que los tickers del CSV coincidan con los de la página de Transacciones.
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}
