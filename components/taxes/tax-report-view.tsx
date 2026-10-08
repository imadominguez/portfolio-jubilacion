import type { ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatARS, formatCurrency, formatDateUTC } from "@/lib/format";
import { totalsByCurrency, type TaxReport } from "@/lib/tax-report";

const HEAD = "text-[11px] font-semibold tracking-wider uppercase text-muted-foreground/70 h-9";
const NUM = "py-3 text-right text-xs font-mono tabular-nums";

// Más de una semana antes del 31/12 ya no es la valuación de cierre.
const YEAR_END_TOLERANCE_DAYS = 7;

function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
      <AlertTriangle className="size-4 shrink-0 text-warning" />
      <p>{children}</p>
    </div>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="animate-fade-up flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-base font-semibold text-foreground">{title}</h2>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-2xl">{description}</p>
      </div>
      {children}
    </section>
  );
}

function TableCard({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm overflow-x-auto">
      <Table>{children}</Table>
    </div>
  );
}

function EmptyRow({ colSpan, children }: { colSpan: number; children: ReactNode }) {
  return (
    <TableRow className="hover:bg-transparent">
      <TableCell colSpan={colSpan} className="py-6 text-center text-xs text-muted-foreground">
        {children}
      </TableCell>
    </TableRow>
  );
}

function signColor(value: number) {
  return value >= 0 ? "text-success" : "text-destructive";
}

export function TaxReportView({ report }: { report: TaxReport }) {
  const { year, holdings, sales, dividends } = report;
  const salesTotals = totalsByCurrency(
    sales.filter((s) => s.result !== null),
    (s) => s.result ?? 0
  );
  const dividendTotals = totalsByCurrency(dividends, (d) => d.amount);
  const dividendCosts = dividends.reduce((acc, d) => acc + d.costsArs, 0);

  return (
    <div className="flex flex-col gap-10">
      <Section
        title={`Tenencia al cierre de ${year}`}
        description={
          <>
            Para Bienes Personales: cada posición del último snapshot del año, valuada al precio de esa
            fecha. No incluye el efectivo de la cuenta (pesos y dólares); ese saldo sale del resumen de
            Cocos al 31/12.
          </>
        }
      >
        {holdings === null ? (
          <Notice>
            No hay ningún snapshot de {year}. Importá el reporte de tenencia de Cocos con fecha 31/12/{year}.
          </Notice>
        ) : (
          <>
            {holdings.daysBeforeYearEnd > YEAR_END_TOLERANCE_DAYS && (
              <Notice>
                El último snapshot de {year} es del {formatDateUTC(holdings.snapshotDate)}, no del cierre del
                año. Importá el reporte de tenencia de Cocos con fecha 31/12/{year} para tener la valuación
                correcta.
              </Notice>
            )}
            <TableCard>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent bg-muted/40">
                  <TableHead className={`pl-4 ${HEAD}`}>Instrumento</TableHead>
                  <TableHead className={`text-right ${HEAD}`}>Cantidad</TableHead>
                  <TableHead className={`text-right ${HEAD}`}>Precio</TableHead>
                  <TableHead className={`pr-4 text-right ${HEAD}`}>Valor</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {holdings.positions.map((p) => (
                  <TableRow key={p.ticker} className="border-border/60">
                    <TableCell className="pl-4 py-3">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-bold font-mono text-foreground">{p.ticker}</span>
                        {p.instrumentName && (
                          <span className="text-[11px] text-muted-foreground">{p.instrumentName}</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className={`${NUM} text-muted-foreground`}>
                      {p.quantity.toLocaleString("es-AR", { maximumFractionDigits: 8 })}
                    </TableCell>
                    <TableCell className={`${NUM} text-muted-foreground`}>{formatARS(p.price)}</TableCell>
                    <TableCell className={`pr-4 ${NUM} text-foreground`}>{formatARS(p.value)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={3} className="pl-4 py-3 text-xs font-semibold">
                    Total al {formatDateUTC(holdings.snapshotDate)}
                  </TableCell>
                  <TableCell className={`pr-4 ${NUM} font-semibold text-foreground`}>
                    {formatARS(holdings.totalValueArs)}
                  </TableCell>
                </TableRow>
              </TableFooter>
            </TableCard>
          </>
        )}
      </Section>

      <Section
        title={`Ventas de ${year}`}
        description={
          <>
            Para Ganancias: el resultado de cada venta contra el costo promedio de compra, con las
            comisiones de compra y venta. Sale de las transacciones importadas, así que necesita todas las
            compras, incluidas las de años anteriores.
          </>
        }
      >
        {sales.some((s) => s.missingBuys) && (
          <Notice>
            Alguna venta supera las compras registradas: a esa diferencia le falta el costo y el resultado
            está inflado. Importá los movimientos de los años anteriores en Transacciones.
          </Notice>
        )}
        {sales.some((s) => s.result === null) && (
          <Notice>
            Las ventas sin resultado se compraron en otra moneda (por ejemplo, una ON comprada en pesos y
            vendida en dólares para hacer dólar MEP). Pasar el costo a la moneda de la venta pide elegir un
            tipo de cambio, así que ese resultado queda para la declaración.
          </Notice>
        )}
        <TableCard>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/40">
              <TableHead className={`pl-4 ${HEAD}`}>Fecha</TableHead>
              <TableHead className={HEAD}>Ticker</TableHead>
              <TableHead className={`text-right ${HEAD}`}>Cantidad</TableHead>
              <TableHead className={`text-right ${HEAD}`}>Ingreso neto</TableHead>
              <TableHead className={`text-right ${HEAD}`}>Costo</TableHead>
              <TableHead className={`pr-4 text-right ${HEAD}`}>Resultado</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.length === 0 ? (
              <EmptyRow colSpan={6}>No registraste ventas en {year}.</EmptyRow>
            ) : (
              sales.map((s, i) => (
                <TableRow key={`${s.ticker}-${s.date.getTime()}-${i}`} className="border-border/60">
                  <TableCell className="pl-4 py-3 text-xs font-mono text-muted-foreground">
                    {formatDateUTC(s.date)}
                  </TableCell>
                  <TableCell className="py-3">
                    <span className="text-sm font-bold font-mono text-foreground">{s.ticker}</span>
                    {s.missingBuys && <AlertTriangle className="inline ml-1.5 size-3.5 text-warning" />}
                  </TableCell>
                  <TableCell className={`${NUM} text-muted-foreground`}>
                    {s.quantity.toLocaleString("es-AR", { maximumFractionDigits: 8 })}
                  </TableCell>
                  <TableCell className={`${NUM} text-muted-foreground`}>
                    {formatCurrency(s.proceeds, s.currency)}
                  </TableCell>
                  <TableCell className={`${NUM} text-muted-foreground`}>
                    {s.cost !== null && s.costCurrency !== null ? formatCurrency(s.cost, s.costCurrency) : "—"}
                  </TableCell>
                  <TableCell
                    className={`pr-4 ${NUM} font-semibold ${s.result === null ? "text-muted-foreground" : signColor(s.result)}`}
                  >
                    {s.result === null ? "—" : formatCurrency(s.result, s.currency)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {sales.length > 0 && (
            <TableFooter>
              {Object.entries(salesTotals).map(([currency, total]) => (
                <TableRow key={currency} className="hover:bg-transparent">
                  <TableCell colSpan={5} className="pl-4 py-3 text-xs font-semibold">
                    Resultado total en {currency}
                  </TableCell>
                  <TableCell className={`pr-4 ${NUM} font-semibold ${signColor(total)}`}>
                    {formatCurrency(total, currency)}
                  </TableCell>
                </TableRow>
              ))}
            </TableFooter>
          )}
        </TableCard>
      </Section>

      <Section
        title={`Dividendos cobrados en ${year}`}
        description={
          <>
            Del libro de movimientos de Cocos más los que cargaste a mano. Cocos acredita los dividendos de
            CEDEARs en dólares sin decir de qué acción vienen; los gastos son los que descontó en pesos.
          </>
        }
      >
        <TableCard>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent bg-muted/40">
              <TableHead className={`pl-4 ${HEAD}`}>Fecha</TableHead>
              <TableHead className={HEAD}>Instrumento</TableHead>
              <TableHead className={`text-right ${HEAD}`}>Monto</TableHead>
              <TableHead className={`pr-4 text-right ${HEAD}`}>Gastos</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {dividends.length === 0 ? (
              <EmptyRow colSpan={4}>No hay dividendos registrados en {year}.</EmptyRow>
            ) : (
              dividends.map((d, i) => (
                <TableRow key={`${d.date.getTime()}-${i}`} className="border-border/60">
                  <TableCell className="pl-4 py-3 text-xs font-mono text-muted-foreground">
                    {formatDateUTC(d.date)}
                  </TableCell>
                  <TableCell className="py-3 text-xs text-foreground">
                    {d.source}
                    {d.manual && <span className="ml-1.5 text-[11px] text-muted-foreground">(manual)</span>}
                  </TableCell>
                  <TableCell className={`${NUM} text-foreground`}>
                    {formatCurrency(d.amount, d.currency)}
                  </TableCell>
                  <TableCell className={`pr-4 ${NUM} text-muted-foreground`}>
                    {d.costsArs > 0 ? formatCurrency(d.costsArs, "ARS") : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
          {dividends.length > 0 && (
            <TableFooter>
              {Object.entries(dividendTotals).map(([currency, total]) => (
                <TableRow key={currency} className="hover:bg-transparent">
                  <TableCell colSpan={2} className="pl-4 py-3 text-xs font-semibold">
                    Total en {currency}
                  </TableCell>
                  <TableCell className={`${NUM} font-semibold text-foreground`}>
                    {formatCurrency(total, currency)}
                  </TableCell>
                  <TableCell className={`pr-4 ${NUM} text-muted-foreground`}>
                    {currency === "ARS" || !dividendTotals.ARS ? formatCurrency(dividendCosts, "ARS") : ""}
                  </TableCell>
                </TableRow>
              ))}
            </TableFooter>
          )}
        </TableCard>
      </Section>
    </div>
  );
}
