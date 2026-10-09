import { formatCurrency, formatUSD, formatUSDCompact } from "@/lib/format";
import { DIVIDEND_WITHHOLDING, capitalForDividendIncome, type DividendProjection } from "@/lib/dividend-projection";

// Cuánto rinde hoy el portfolio en dividendos y cuánto capital haría falta para
// vivir solo de ellos. Sin estado: se renderiza en el servidor.
export function DividendProjectionCard({
  projection,
  monthlyExpensesUsd,
}: {
  projection: DividendProjection;
  monthlyExpensesUsd: number | null;
}) {
  const { rows, missing } = projection;
  const capitalNeeded =
    monthlyExpensesUsd && monthlyExpensesUsd > 0 ? capitalForDividendIncome(monthlyExpensesUsd, projection.yieldPct) : null;
  const top = rows.slice(0, 8);

  return (
    <section className="rounded-xl border border-border bg-card shadow-sm p-6 flex flex-col gap-5">
      <div className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold text-foreground">Dividendos estimados</h3>
        <p className="text-[11px] text-muted-foreground max-w-2xl">
          Con el dividendo anual por acción de cada subyacente y tu tenencia actual. Neto de una retención del{" "}
          {Math.round(DIVIDEND_WITHHOLDING * 100)} % (la de EE.UU. a no residentes). Se actualiza con los precios.
        </p>
      </div>

      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {missing.length > 0
            ? "Todavía no hay datos de dividendos: actualizá los precios desde el Centro de Datos."
            : "Ninguna de tus posiciones paga dividendos."}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Stat label="Por mes, neto" value={usd(projection.monthlyNetUsd)} />
            <Stat label="Por año, neto" value={usd(projection.annualNetUsd)} hint={`${usd(projection.annualGrossUsd)} bruto`} />
            <Stat label="Rendimiento" value={`${projection.yieldPct.toFixed(2)} %`} hint="bruto sobre el portfolio" />
            <Stat
              label="Para vivir de dividendos"
              value={capitalNeeded === null ? "—" : formatUSDCompact(capitalNeeded)}
              hint={monthlyExpensesUsd ? `cubre ${formatUSD(monthlyExpensesUsd)}/mes` : "cargá tus gastos mensuales"}
            />
          </div>

          <ul className="flex flex-col gap-2">
            {top.map((r) => {
              const share = projection.annualGrossUsd > 0 ? (r.annualGrossUsd / projection.annualGrossUsd) * 100 : 0;
              return (
                <li key={r.ticker} className="flex flex-col gap-1">
                  <div className="flex items-baseline justify-between gap-2 text-sm">
                    <span className="text-foreground">
                      {r.ticker}
                      <span className="text-muted-foreground text-xs"> · {r.yieldPct.toFixed(2)} %</span>
                    </span>
                    <span className="font-mono tabular-nums text-xs">
                      {usd(r.annualGrossUsd)}
                      <span className="text-muted-foreground"> / año</span>
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(0, Math.min(100, share))}%` }} />
                  </div>
                </li>
              );
            })}
          </ul>
          {(rows.length > top.length || missing.length > 0) && (
            <p className="text-[11px] text-muted-foreground">
              {rows.length > top.length && `Y ${rows.length - top.length} posiciones más. `}
              {missing.length > 0 && `Sin dato (no entran en el cálculo): ${missing.join(", ")}.`}
            </p>
          )}
        </>
      )}
    </section>
  );
}

// Con montos chicos los enteros esconden todo ("$0 / año"): debajo de US$ 1.000, con centavos.
function usd(value: number): string {
  return value < 1000 ? formatCurrency(value, "USD") : formatUSD(value);
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono tabular-nums text-lg text-foreground">{value}</span>
      {hint && <span className="text-[11px] text-muted-foreground">{hint}</span>}
    </div>
  );
}
