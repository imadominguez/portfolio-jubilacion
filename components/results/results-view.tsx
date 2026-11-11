"use client";

import { useRef, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { SectionHeading, StatGrid, type Stat } from "@/components/layout/page-parts";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatDateUTC } from "@/lib/format";
import type { YearResults } from "@/lib/ticker-results";
import { cn } from "@/lib/utils";
import { GainsByTickerChart, MonthlyFlowsChart } from "./results-charts";
import { fmtMoney, fmtSignedPct, pick, toneClass, type Currency } from "./results-format";
import { TickerDetail } from "./ticker-detail";

const HEAD = "text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9";
const NUM = "py-3 text-right text-xs font-mono tabular-nums";

const tone = (v: number | null): Stat["tone"] => (v === null || Math.abs(v) < 0.005 ? null : v > 0 ? "positive" : "negative");

export function ResultsView({ results }: { results: YearResults }) {
  const [currency, setCurrency] = useState<Currency>("ARS");
  const [selected, setSelected] = useState<string | null>(results.tickers[0]?.ticker ?? null);
  const detailRef = useRef<HTMLDivElement>(null);
  const c = currency;
  const t = results.totals;
  const detail = results.tickers.find((r) => r.ticker === selected) ?? null;
  const flagged = results.tickers.filter((r) => r.quantityMismatch || r.unvaluedStart);
  const base = t.start.ars + t.bought.ars;
  const baseUsd = t.start.usd !== null && t.bought.usd !== null ? t.start.usd + t.bought.usd : null;
  const totalPct = c === "ARS" ? (base > 0 ? t.total.ars / base : null) : baseUsd && t.total.usd !== null ? t.total.usd / baseUsd : null;

  const select = (ticker: string) => {
    setSelected(ticker);
    detailRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          Período: {results.start ? `snapshot del ${formatDateUTC(results.start.date)}` : `1/1/${results.year}`} al
          snapshot del {formatDateUTC(results.end.date)}
        </p>
        <div className="flex gap-1.5" role="group" aria-label="Moneda">
          {(["ARS", "USD"] as Currency[]).map((cur) => (
            <Button
              key={cur}
              size="sm"
              variant={currency === cur ? "default" : "outline"}
              className="h-7 px-3 font-mono text-xs"
              onClick={() => setCurrency(cur)}
              aria-pressed={currency === cur}
            >
              {cur}
            </Button>
          ))}
        </div>
      </div>

      {results.tradesAfterEnd > 0 && (
        <Notice>
          {results.tradesAfterEnd === 1
            ? "Hay 1 operación que liquida después del último snapshot"
            : `Hay ${results.tradesAfterEnd} operaciones que liquidan después del último snapshot`}
          : la tenencia de Cocos todavía no las incluye, así que entran en el cálculo con el próximo snapshot.
        </Notice>
      )}
      {flagged.length > 0 && (
        <Notice>
          {flagged.map((r) => r.ticker).join(", ")}: la tenencia no cierra con las operaciones o falta el valor inicial.
          Mirá el detalle de cada uno.
        </Notice>
      )}

      <StatGrid
        stats={[
          { label: "Resultado del año", value: fmtMoney(pick(t.total, c), c), sub: `${fmtSignedPct(totalPct)} sobre lo invertido`, tone: tone(pick(t.total, c)) },
          { label: "Realizado (ventas)", value: fmtMoney(pick(t.realized, c), c), sub: `Vendiste ${fmtMoney(pick(t.sold, c), c)}`, tone: tone(pick(t.realized, c)) },
          { label: "No realizado", value: fmtMoney(pick(t.unrealized, c), c), sub: `Compraste ${fmtMoney(pick(t.bought, c), c)}`, tone: tone(pick(t.unrealized, c)) },
          { label: "Dividendos", value: fmtMoney(pick(t.dividends, c), c), sub: "Netos de gastos", tone: tone(pick(t.dividends, c)) },
        ]}
      />

      <div className="grid gap-8 lg:grid-cols-2">
        <section className="flex flex-col gap-3">
          <SectionHeading title="Resultado por ticker" description="Cuánto aportó cada uno, separado en ventas, variación de lo que tenés y dividendos." />
          <GainsByTickerChart tickers={results.tickers} currency={c} />
        </section>
        <section className="flex flex-col gap-3">
          <SectionHeading title="Compras y ventas por mes" description="Montos operados: compras hacia arriba, ventas hacia abajo." />
          {results.monthly.length > 0 ? (
            <MonthlyFlowsChart monthly={results.monthly} currency={c} />
          ) : (
            <p className="py-16 text-center text-xs text-muted-foreground">Sin operaciones en el período.</p>
          )}
        </section>
      </div>

      <section className="flex flex-col gap-3">
        <SectionHeading title="Detalle por ticker" description="Tocá una fila para ver sus operaciones y gráficos." />
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-transparent">
                <TableHead className={`${HEAD} pl-4`}>Ticker</TableHead>
                <TableHead className={`${HEAD} text-right`}>Inicial</TableHead>
                <TableHead className={`${HEAD} text-right`}>Compras</TableHead>
                <TableHead className={`${HEAD} text-right`}>Ventas</TableHead>
                <TableHead className={`${HEAD} text-right`}>Final</TableHead>
                <TableHead className={`${HEAD} text-right`}>Realizado</TableHead>
                <TableHead className={`${HEAD} text-right`}>No realizado</TableHead>
                <TableHead className={`${HEAD} text-right`}>Dividendos</TableHead>
                <TableHead className={`${HEAD} text-right`}>Resultado</TableHead>
                <TableHead className={`${HEAD} pr-4 text-right`}>%</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.tickers.map((r) => {
                const total = pick(r.total, c);
                return (
                  <TableRow
                    key={r.ticker}
                    onClick={() => select(r.ticker)}
                    className={cn("cursor-pointer border-border", r.ticker === selected && "bg-muted/50")}
                  >
                    <TableCell className="py-3 pl-4 font-mono text-xs font-semibold">
                      <button type="button" className="flex items-center gap-1.5 text-left" onClick={(e) => {
                          e.stopPropagation();
                          select(r.ticker);
                        }}
                      >
                        {r.ticker}
                        {(r.quantityMismatch || r.unvaluedStart) && <AlertTriangle className="size-3.5 text-warning" aria-label="Datos incompletos" />}
                      </button>
                    </TableCell>
                    <TableCell className={NUM}>{fmtMoney(pick(r.start, c), c)}</TableCell>
                    <TableCell className={NUM}>{fmtMoney(pick(r.bought, c), c)}</TableCell>
                    <TableCell className={NUM}>{fmtMoney(pick(r.sold, c), c)}</TableCell>
                    <TableCell className={NUM}>{fmtMoney(pick(r.end, c), c)}</TableCell>
                    <TableCell className={cn(NUM, toneClass(pick(r.realized, c)))}>{fmtMoney(pick(r.realized, c), c)}</TableCell>
                    <TableCell className={cn(NUM, toneClass(pick(r.unrealized, c)))}>{fmtMoney(pick(r.unrealized, c), c)}</TableCell>
                    <TableCell className={NUM}>{fmtMoney(pick(r.dividends, c), c)}</TableCell>
                    <TableCell className={cn(NUM, "font-semibold", toneClass(total))}>{fmtMoney(total, c)}</TableCell>
                    <TableCell className={cn(NUM, "pr-4", toneClass(total))}>{fmtSignedPct(pick(r.returnPct, c))}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
            <TableFooter>
              <TableRow className="hover:bg-transparent">
                <TableCell className="py-3 pl-4 text-xs font-semibold">Total</TableCell>
                <TableCell className={NUM}>{fmtMoney(pick(t.start, c), c)}</TableCell>
                <TableCell className={NUM}>{fmtMoney(pick(t.bought, c), c)}</TableCell>
                <TableCell className={NUM}>{fmtMoney(pick(t.sold, c), c)}</TableCell>
                <TableCell className={NUM}>{fmtMoney(pick(t.end, c), c)}</TableCell>
                <TableCell className={cn(NUM, toneClass(pick(t.realized, c)))}>{fmtMoney(pick(t.realized, c), c)}</TableCell>
                <TableCell className={cn(NUM, toneClass(pick(t.unrealized, c)))}>{fmtMoney(pick(t.unrealized, c), c)}</TableCell>
                <TableCell className={NUM}>{fmtMoney(pick(t.dividends, c), c)}</TableCell>
                <TableCell className={cn(NUM, "font-semibold", toneClass(pick(t.total, c)))}>{fmtMoney(pick(t.total, c), c)}</TableCell>
                <TableCell className={cn(NUM, "pr-4", toneClass(pick(t.total, c)))}>{fmtSignedPct(totalPct)}</TableCell>
              </TableRow>
            </TableFooter>
          </Table>
        </div>
      </section>

      {detail && (
        <section ref={detailRef} className="flex scroll-mt-20 flex-col gap-4 border-t border-border pt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 className="font-mono text-lg font-semibold text-foreground">{detail.ticker}</h2>
            <NativeSelect
              value={detail.ticker}
              onChange={(e) => setSelected(e.target.value)}
              aria-label="Ticker"
              className="w-40"
            >
              {results.tickers.map((r) => (
                <NativeSelectOption key={r.ticker} value={r.ticker}>
                  {r.ticker}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
          <TickerDetail result={detail} currency={c} />
        </section>
      )}

      <p className="max-w-3xl text-xs leading-relaxed text-muted-foreground">
        Resultado = valor final − valor inicial − compras + ventas + dividendos, con los valores de los snapshots de
        Cocos. Así las compras no cuentan como ganancia. El realizado compara cada venta con el costo promedio de lo
        vendido (incluye compras de años anteriores); el no realizado es el resto. En dólares, cada compra, venta y
        dividendo se pasa al CCL de su fecha y cada snapshot al CCL que tiene guardado: la diferencia con el resultado en
        pesos es el efecto del tipo de cambio. No es el cálculo impositivo (ver Impuestos).
      </p>
    </div>
  );
}

function Notice({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <AlertTriangle className="size-4 shrink-0 text-warning" />
      <p>{children}</p>
    </div>
  );
}
