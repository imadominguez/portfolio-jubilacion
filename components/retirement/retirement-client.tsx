"use client";

import { useState, useTransition, useMemo } from "react";
import { toast } from "sonner";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";
import { ChartContainer } from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import { Badge } from "@/components/ui/badge";
import { Target, TrendingUp, AlertTriangle, CheckCircle } from "lucide-react";
import type { RetirementSettingsData } from "@/app/actions/retirement";
import { saveRetirementSettings } from "@/app/actions/retirement";
import {
  calculateRetirementGoal,
  buildProjectionCurve,
  runMonteCarlo,
} from "@/lib/projections";

interface RetirementClientProps {
  initialSettings: RetirementSettingsData | null;
  currentPortfolioUsd: number | null;
  historicalCagr: number;
}

const DEFAULT_SETTINGS: RetirementSettingsData = {
  currentAge: 35,
  retirementAge: 65,
  monthlyExpensesUsd: 3000,
  inflationRate: 0.03,
  withdrawalRate: 0.04,
  monthlyContribution: 500,
};

type Tab = "calculator" | "projection" | "montecarlo";

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(v);
}

const chartConfig = {
  projected: { label: "Portfolio proyectado", color: "var(--color-chart-1)" },
  p50: { label: "Mediana (P50)", color: "var(--color-chart-1)" },
  p10: { label: "Pesimista (P10)", color: "var(--color-chart-3)" },
  p90: { label: "Optimista (P90)", color: "var(--color-chart-2)" },
};

export function RetirementClient({
  initialSettings,
  currentPortfolioUsd,
  historicalCagr,
}: RetirementClientProps) {
  const [settings, setSettings] = useState<RetirementSettingsData>(
    initialSettings ?? DEFAULT_SETTINGS
  );
  const [tab, setTab] = useState<Tab>("calculator");
  const [isPending, startTransition] = useTransition();
  const [isEditing, setIsEditing] = useState(!initialSettings);

  const inputs = {
    ...settings,
    currentPortfolioUsd: currentPortfolioUsd ?? 0,
    annualReturnRate: historicalCagr > 0 ? historicalCagr / 100 : 0.07,
  };

  const goal = useMemo(() => calculateRetirementGoal(inputs), [JSON.stringify(inputs)]);
  const projectionData = useMemo(() => buildProjectionCurve({ ...inputs, capitalNeeded: goal.capitalNeeded } as never), [JSON.stringify(inputs), goal.capitalNeeded]);

  const monteCarloData = useMemo(() => {
    if (tab !== "montecarlo") return null;
    return runMonteCarlo(inputs, 500);
  }, [tab, JSON.stringify(inputs)]);

  const mcChartData = useMemo(() => {
    if (!monteCarloData) return [];
    return monteCarloData.years.map((year, i) => ({
      age: year,
      p10: monteCarloData.percentile10[i],
      p50: monteCarloData.percentile50[i],
      p90: monteCarloData.percentile90[i],
    }));
  }, [monteCarloData]);

  function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const newSettings: RetirementSettingsData = {
      currentAge: parseInt(fd.get("currentAge") as string),
      retirementAge: parseInt(fd.get("retirementAge") as string),
      monthlyExpensesUsd: parseFloat(fd.get("monthlyExpensesUsd") as string),
      inflationRate: parseFloat(fd.get("inflationRate") as string) / 100,
      withdrawalRate: parseFloat(fd.get("withdrawalRate") as string) / 100,
      monthlyContribution: parseFloat(fd.get("monthlyContribution") as string),
    };

    setSettings(newSettings);
    startTransition(async () => {
      const result = await saveRetirementSettings(newSettings);
      if (result.success) {
        toast.success("Configuración guardada");
        setIsEditing(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: "calculator", label: "Calculadora" },
    { id: "projection", label: "Proyección" },
    { id: "montecarlo", label: "Monte Carlo" },
  ];

  return (
    <div className="flex flex-col gap-8">
      {/* Config panel */}
      <div className="rounded-xl border border-border bg-card shadow-sm p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="text-sm font-semibold text-foreground">Parámetros</h3>
          {!isEditing && (
            <Button variant="outline" size="sm" className="text-xs" onClick={() => setIsEditing(true)}>
              Editar
            </Button>
          )}
        </div>

        {isEditing ? (
          <form onSubmit={handleSave} className="flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              <Field>
                <FieldLabel className="text-xs font-medium">Edad actual</FieldLabel>
                <Input
                  name="currentAge"
                  type="number"
                  min="18"
                  max="99"
                  defaultValue={settings.currentAge}
                  required
                  className="text-sm font-mono"
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Edad de retiro</FieldLabel>
                <Input
                  name="retirementAge"
                  type="number"
                  min="30"
                  max="100"
                  defaultValue={settings.retirementAge}
                  required
                  className="text-sm font-mono"
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Gastos mensuales (USD)</FieldLabel>
                <Input
                  name="monthlyExpensesUsd"
                  type="number"
                  min="1"
                  step="100"
                  defaultValue={settings.monthlyExpensesUsd}
                  required
                  className="text-sm font-mono"
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Aporte mensual (USD)</FieldLabel>
                <Input
                  name="monthlyContribution"
                  type="number"
                  min="0"
                  step="50"
                  defaultValue={settings.monthlyContribution}
                  required
                  className="text-sm font-mono"
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Inflación anual (%)</FieldLabel>
                <Input
                  name="inflationRate"
                  type="number"
                  min="0"
                  max="50"
                  step="0.1"
                  defaultValue={(settings.inflationRate * 100).toFixed(1)}
                  required
                  className="text-sm font-mono"
                />
              </Field>
              <Field>
                <FieldLabel className="text-xs font-medium">Tasa de retiro (%)</FieldLabel>
                <Input
                  name="withdrawalRate"
                  type="number"
                  min="1"
                  max="20"
                  step="0.1"
                  defaultValue={(settings.withdrawalRate * 100).toFixed(1)}
                  required
                  className="text-sm font-mono"
                />
                <FieldDescription className="text-[10px] text-muted-foreground">
                  4% = Regla del 4%
                </FieldDescription>
              </Field>
            </div>
            <div className="flex gap-2 justify-end">
              {initialSettings && (
                <Button type="button" variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="text-xs">
                  Cancelar
                </Button>
              )}
              <Button type="submit" size="sm" disabled={isPending} className="gap-2">
                {isPending && <Spinner className="size-3" />}
                Guardar y calcular
              </Button>
            </div>
          </form>
        ) : (
          <div className="grid grid-cols-3 gap-3 sm:grid-cols-6 text-center">
            {[
              { label: "Edad actual", value: settings.currentAge },
              { label: "Retiro a los", value: settings.retirementAge },
              { label: "Gastos/mes", value: formatUSD(settings.monthlyExpensesUsd) },
              { label: "Aporte/mes", value: formatUSD(settings.monthlyContribution) },
              { label: "Inflación", value: `${(settings.inflationRate * 100).toFixed(1)}%` },
              { label: "Tasa retiro", value: `${(settings.withdrawalRate * 100).toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} className="flex flex-col gap-0.5">
                <span className="text-[10px] text-muted-foreground">{label}</span>
                <span className="text-sm font-mono font-semibold text-foreground">{value}</span>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t border-border flex items-center gap-2">
          <span className="text-[10px] text-muted-foreground">
            Retorno anual usado: {(inputs.annualReturnRate * 100).toFixed(2)}%
            {historicalCagr > 0 ? " (CAGR histórico del portfolio)" : " (estimado)"}
          </span>
          {currentPortfolioUsd && (
            <span className="text-[10px] text-muted-foreground">
              · Portfolio actual: {formatUSD(currentPortfolioUsd)}
            </span>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-col gap-6">
        <div className="flex items-center gap-1 border-b border-border">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 -mb-px ${
                tab === t.id
                  ? "border-foreground text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "calculator" && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                label: "Capital necesario",
                value: formatUSD(goal.capitalNeeded),
                sub: `Para retirar ${formatUSD(settings.monthlyExpensesUsd)}/mes`,
                icon: Target,
                accent: null as boolean | null,
              },
              {
                label: "Capital proyectado",
                value: formatUSD(goal.capitalAtRetirement),
                sub: `Al jubilarme a los ${settings.retirementAge}`,
                icon: TrendingUp,
                accent: goal.isOnTrack,
              },
              {
                label: "Brecha actual",
                value: goal.currentGap > 0 ? formatUSD(goal.currentGap) : "¡Meta alcanzada!",
                sub: `Faltan ${goal.yearsRemaining} años`,
                icon: goal.isOnTrack ? CheckCircle : AlertTriangle,
                accent: goal.isOnTrack,
              },
              {
                label: "Años para la meta",
                value:
                  goal.yearsToGoal <= goal.yearsRemaining
                    ? `${goal.yearsToGoal.toFixed(1)} años`
                    : "Ajustar aportes",
                sub: goal.yearsToGoal <= goal.yearsRemaining ? "En camino" : "Revisar parámetros",
                icon: TrendingUp,
                accent: goal.yearsToGoal <= goal.yearsRemaining,
              },
            ].map(({ label, value, sub, icon: Icon, accent }) => (
              <div
                key={label}
                className={`rounded-xl border bg-card shadow-sm px-5 py-4 flex flex-col gap-3 ${
                  accent === true
                    ? "border-emerald-500/30"
                    : accent === false
                      ? "border-amber-500/30"
                      : "border-border"
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-sm font-semibold text-foreground">{label}</span>
                    <span className="text-xs text-muted-foreground">{sub}</span>
                  </div>
                  <Icon
                    className={`size-4 shrink-0 ${
                      accent === true
                        ? "text-emerald-500"
                        : accent === false
                          ? "text-amber-500"
                          : "text-muted-foreground"
                    }`}
                  />
                </div>
                <span
                  className={`text-xl font-bold font-mono tabular-nums leading-none ${
                    accent === true
                      ? "text-emerald-500"
                      : accent === false
                        ? "text-amber-500"
                        : "text-foreground"
                  }`}
                >
                  {value}
                </span>
                <div className="flex items-center gap-1.5">
                  <Badge
                    variant={goal.isOnTrack ? "default" : "secondary"}
                    className="text-[10px] h-4"
                  >
                    {goal.isOnTrack ? "En camino" : "Ajustar"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === "projection" && (
          <div className="rounded-xl border border-border bg-card shadow-sm p-6">
            <h3 className="text-sm font-semibold text-foreground mb-5">
              Proyección de crecimiento del portfolio
            </h3>
            <ChartContainer config={chartConfig} className="h-[360px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={projectionData.map((p) => ({
                    age: `${p.age}`,
                    projected: p.projected,
                    goal: goal.capitalNeeded,
                  }))}
                  margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
                >
                  <defs>
                    <linearGradient id="projGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="var(--color-chart-1)" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="var(--color-chart-1)" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                  <XAxis
                    dataKey="age"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    label={{ value: "Edad", position: "insideBottom", offset: -2, style: { fontSize: 10, fill: "var(--color-muted-foreground)" } }}
                  />
                  <YAxis
                    tickFormatter={(v) => formatUSD(v)}
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    tickLine={false}
                    axisLine={false}
                    width={80}
                  />
                  <Tooltip
                    formatter={(v: number, name: string) => [
                      formatUSD(v),
                      name === "projected" ? "Portfolio" : "Meta",
                    ]}
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                  />
                  <ReferenceLine
                    y={goal.capitalNeeded}
                    stroke="var(--color-chart-3)"
                    strokeDasharray="6 3"
                    label={{ value: "Meta", fill: "var(--color-muted-foreground)", fontSize: 11 }}
                  />
                  <ReferenceLine
                    x={`${settings.retirementAge}`}
                    stroke="var(--color-muted-foreground)"
                    strokeDasharray="4 2"
                    opacity={0.5}
                  />
                  <Area
                    type="monotone"
                    dataKey="projected"
                    stroke="var(--color-chart-1)"
                    strokeWidth={2}
                    fill="url(#projGradient)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </ChartContainer>
            <p className="text-xs text-muted-foreground mt-3">
              La línea vertical marca la edad de retiro. La línea punteada marca el capital necesario.
            </p>
          </div>
        )}

        {tab === "montecarlo" && monteCarloData && (
          <div className="flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">Probabilidad de éxito</p>
                <p
                  className={`text-2xl font-bold font-mono ${
                    monteCarloData.successProbability >= 70
                      ? "text-emerald-500"
                      : monteCarloData.successProbability >= 50
                        ? "text-amber-500"
                        : "text-destructive"
                  }`}
                >
                  {monteCarloData.successProbability.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground mt-1">de 500 simulaciones</p>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">Escenario pesimista (P10)</p>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {formatUSD(monteCarloData.percentile10[monteCarloData.percentile10.length - 1])}
                </p>
              </div>
              <div className="rounded-xl border border-border bg-card shadow-sm px-5 py-4">
                <p className="text-xs text-muted-foreground mb-1">Escenario optimista (P90)</p>
                <p className="text-2xl font-bold font-mono text-foreground">
                  {formatUSD(monteCarloData.percentile90[monteCarloData.percentile90.length - 1])}
                </p>
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card shadow-sm p-6">
              <ChartContainer config={chartConfig} className="h-[360px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={mcChartData}
                    margin={{ top: 4, right: 4, left: 0, bottom: 4 }}
                  >
                    <defs>
                      <linearGradient id="p90Gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-chart-2)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-chart-2)" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="p10Gradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--color-chart-3)" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="var(--color-chart-3)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" opacity={0.4} />
                    <XAxis
                      dataKey="age"
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      tickFormatter={(v) => formatUSD(v)}
                      tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                      width={80}
                    />
                    <Tooltip
                      formatter={(v: number, name: string) => [
                        formatUSD(v),
                        name === "p10" ? "Pesimista (P10)" : name === "p90" ? "Optimista (P90)" : "Mediana (P50)",
                      ]}
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                    />
                    <ReferenceLine
                      y={goal.capitalNeeded}
                      stroke="var(--color-chart-3)"
                      strokeDasharray="6 3"
                      label={{ value: "Meta", fill: "var(--color-muted-foreground)", fontSize: 11 }}
                    />
                    <Area type="monotone" dataKey="p90" stroke="var(--color-chart-2)" strokeWidth={1.5} fill="url(#p90Gradient)" />
                    <Area type="monotone" dataKey="p50" stroke="var(--color-chart-1)" strokeWidth={2.5} fill="none" />
                    <Area type="monotone" dataKey="p10" stroke="var(--color-chart-3)" strokeWidth={1.5} fill="url(#p10Gradient)" />
                  </AreaChart>
                </ResponsiveContainer>
              </ChartContainer>
              <p className="text-xs text-muted-foreground mt-3">
                Banda P10–P90 basada en 500 simulaciones con volatilidad histórica estimada del 4% mensual.
              </p>
            </div>
          </div>
        )}

        {tab === "montecarlo" && !monteCarloData && (
          <div className="flex items-center justify-center py-16">
            <Spinner className="size-6" />
          </div>
        )}
      </div>
    </div>
  );
}
