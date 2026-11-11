"use client";

import { AlertTriangle } from "lucide-react";
import { StatGrid, type Stat } from "@/components/layout/page-parts";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatARS, formatDateUTC } from "@/lib/format";
import type { TickerResult } from "@/lib/ticker-results";
import { TickerPositionChart, TickerPriceChart } from "./results-charts";
import { fmtMoney, fmtQty, fmtSignedPct, pick, toneClass, type Currency } from "./results-format";

const HEAD = "text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9";
const NUM = "py-2.5 text-right text-xs font-mono tabular-nums";

const tone = (v: number | null): Stat["tone"] => (v === null || Math.abs(v) < 0.005 ? null : v > 0 ? "positive" : "negative");

export function TickerDetail({ result, currency }: { result: TickerResult; currency: Currency }) {
  const c = currency;
  const total = pick(result.total, c);

  return (
    <div className="flex flex-col gap-6">
      {result.quantityMismatch && (
        <Notice>
          Con las operaciones registradas la tenencia final debería ser {fmtQty(result.quantityMismatch.expected)}, pero
          el snapshot tiene {fmtQty(result.quantityMismatch.actual)}. Faltan movimientos por importar o hay un cambio de
          ratio sin registrar: el resultado de {result.ticker} no es confiable.
        </Notice>
      )}
      {result.unvaluedStart && (
        <Notice>
          Tenías {result.ticker} antes del año pero no hay un snapshot previo que la valúe: el valor inicial cuenta como
          cero y el resultado está sobreestimado.
        </Notice>
      )}

      <StatGrid
        stats={[
          { label: "Resultado del año", value: fmtMoney(total, c), sub: `${fmtSignedPct(pick(result.returnPct, c))} sobre lo invertido`, tone: tone(total) },
          { label: "Realizado (ventas)", value: fmtMoney(pick(result.realized, c), c), sub: `${fmtQty(result.soldQuantity)} vendidos`, tone: tone(pick(result.realized, c)) },
          { label: "No realizado", value: fmtMoney(pick(result.unrealized, c), c), sub: `Tenencia final ${fmtQty(result.endQuantity)}`, tone: tone(pick(result.unrealized, c)) },
          { label: "Dividendos", value: fmtMoney(pick(result.dividends, c), c), sub: "Netos de gastos", tone: tone(pick(result.dividends, c)) },
        ]}
      />

      <div className="grid gap-px overflow-hidden rounded-xl border border-border bg-border text-xs sm:grid-cols-4">
        {[
          ["Valor inicial", result.start, `${fmtQty(result.startQuantity)} u.`],
          ["Compras", result.bought, `${fmtQty(result.boughtQuantity)} u.`],
          ["Ventas", result.sold, `${fmtQty(result.soldQuantity)} u.`],
          ["Valor final", result.end, `${fmtQty(result.endQuantity)} u.`],
        ].map(([label, money, sub]) => (
          <div key={label as string} className="flex flex-col gap-0.5 bg-card px-4 py-3">
            <span className="text-muted-foreground">{label as string}</span>
            <span className="font-mono text-sm font-semibold tabular-nums">{fmtMoney(pick(money as TickerResult["start"], c), c)}</span>
            <span className="text-muted-foreground">{sub as string}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Precio y operaciones</h3>
        <p className="text-xs text-muted-foreground">
          Precio por CEDEAR en cada snapshot, tus compras (▲) y ventas (◆) al precio que pagaste o cobraste, y tu costo
          promedio después de cada operación.
        </p>
        <TickerPriceChart result={result} currency={c} />
      </section>

      {result.events.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-semibold text-foreground">Tenencia</h3>
          <TickerPositionChart result={result} />
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold text-foreground">Operaciones del período</h3>
        <div className="overflow-x-auto rounded-xl border border-border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40 hover:bg-transparent">
                <TableHead className={`${HEAD} pl-4`}>Fecha</TableHead>
                <TableHead className={HEAD}>Tipo</TableHead>
                <TableHead className={`${HEAD} text-right`}>Cantidad</TableHead>
                <TableHead className={`${HEAD} text-right`}>Precio u.</TableHead>
                <TableHead className={`${HEAD} text-right`}>Monto</TableHead>
                <TableHead className={`${HEAD} text-right`}>CCL</TableHead>
                <TableHead className={`${HEAD} text-right`}>Costo prom.</TableHead>
                <TableHead className={`${HEAD} text-right`}>Resultado</TableHead>
                <TableHead className={`${HEAD} pr-4 text-right`}>Tenencia</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {result.events.length === 0 && (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={9} className="py-6 text-center text-xs text-muted-foreground">
                    Sin compras ni ventas en el período: el resultado es solo la variación de precio.
                  </TableCell>
                </TableRow>
              )}
              {result.events.map((e, i) => {
                const realized = e.realized ? pick(e.realized, c) : null;
                return (
                  <TableRow key={i} className="border-border">
                    <TableCell className="py-2.5 pl-4 text-xs font-mono tabular-nums">{formatDateUTC(e.date)}</TableCell>
                    <TableCell className="py-2.5">
                      <Badge variant={e.type === "BUY" ? "secondary" : "outline"} className="text-[10px]">
                        {e.type === "BUY" ? "Compra" : "Venta"}
                        {e.currency === "USD" && " · USD"}
                      </Badge>
                    </TableCell>
                    <TableCell className={NUM}>{fmtQty(e.quantity)}</TableCell>
                    <TableCell className={NUM}>{fmtMoney(pick(e.unitPrice, c), c)}</TableCell>
                    <TableCell className={NUM}>{fmtMoney(pick(e.amount, c), c)}</TableCell>
                    <TableCell className={`${NUM} text-muted-foreground`}>{e.ccl ? formatARS(e.ccl) : "—"}</TableCell>
                    <TableCell className={`${NUM} text-muted-foreground`}>
                      {e.avgCostAfter ? fmtMoney(pick(e.avgCostAfter, c), c) : "—"}
                    </TableCell>
                    <TableCell className={`${NUM} ${toneClass(realized)}`}>{e.realized ? fmtMoney(realized, c) : ""}</TableCell>
                    <TableCell className={`${NUM} pr-4`}>{fmtQty(e.positionAfter)}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
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
