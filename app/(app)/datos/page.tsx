import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  Database,
  Gauge,
  LineChart,
  Scale,
  Target,
  TrendingUp,
  Trophy,
  Upload,
} from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { Skeleton } from "@/components/ui/skeleton";
import { SetupChecklist } from "@/components/setup/setup-checklist";
import { SetupPanel } from "@/components/setup/setup-panel";
import { getSession } from "@/lib/auth-session";
import { isAdminRole } from "@/lib/user-role";
import { ImportButton } from "@/components/snapshots/snapshots-client";
import { ImportMovimientosButton } from "@/components/transactions/import-movements-button";
import { CclUpdateButton } from "@/components/exchange-rate/ccl-update-button";
import { MarketPricesButton } from "@/components/market/market-prices-button";
import { IndicesUpdateButton } from "@/components/market/indices-update-button";
import { RealGainsWizard } from "@/components/real-gains/real-gains-wizard";
import { getSetupStatus } from "@/app/actions/setup";
import { getDataReadiness } from "@/lib/real-gains-data";
import { getMarketPrices } from "@/app/actions/market-prices";
import { getAllExchangeRates } from "@/app/actions/exchange-rate";
import { getIndexPoints } from "@/app/actions/indices";


export const metadata: Metadata = { title: "Centro de Datos" };

// Columnas @db.Date: medianoche UTC, se muestran en UTC para no correr el día.
function fmtDate(date: Date | null): string {
  if (!date) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

// Momento de una actualización (timestamp), en hora de Argentina.
function fmtDateTime(date: Date): string {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Argentina/Buenos_Aires",
  }).format(date);
}

function DataCard({
  icon: Icon,
  title,
  description,
  meta,
  action,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  meta?: React.ReactNode;
  action: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4 animate-fade-up">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-muted/50 p-2 shrink-0">
          <Icon className="size-4 text-muted-foreground" />
        </div>
        <div className="flex flex-col gap-0.5 min-w-0">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {description}
          </p>
        </div>
      </div>
      {meta && (
        <div className="text-xs text-muted-foreground flex items-center gap-1.5">
          {meta}
        </div>
      )}
      <div className="mt-auto">{action}</div>
    </div>
  );
}

function PreferenceLink({
  icon: Icon,
  title,
  description,
  href,
}: {
  icon: React.ElementType;
  title: string;
  description: string;
  href: string;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl border border-border bg-card shadow-sm p-5 flex items-center gap-3 transition-all hover:shadow-md hover:border-primary/30"
    >
      <div className="rounded-lg bg-muted/50 p-2 shrink-0">
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex flex-col gap-0.5 min-w-0 flex-1">
        <p className="text-sm font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>
      <ArrowRight className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 shrink-0" />
    </Link>
  );
}

// Casi todo el Centro de Datos es estático (títulos, descripciones, botones de
// importar/actualizar) y entra al static shell. Solo se streamea lo que depende
// del usuario o de la base: el checklist, el dato de cada tarjeta de la sección
// 2, los históricos y el link de Hitos (según el rol).
export default function DataHubPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader
        title="Centro de Datos"
        description="Importá y mantené actualizada tu información"
      />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-6xl w-full mx-auto">
        <section className="animate-fade-up flex flex-col gap-1">
          <p className="text-[10px] font-medium tracking-[0.2em] text-muted-foreground uppercase">
            Todo en un solo lugar
          </p>
          <p className="text-sm text-muted-foreground max-w-xl leading-relaxed">
            Desde acá cargás y actualizás cada tipo de dato del portfolio. Seguí el
            checklist para no olvidarte de nada.
          </p>
        </section>

        <Suspense fallback={<Skeleton className="h-28 w-full rounded-xl" />}>
          <SetupSection />
        </Suspense>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">
            1 · Importar datos de Cocos
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <DataCard
              icon={CalendarDays}
              title="Snapshot del portfolio"
              description="CSV de Portfolio. Es el estado de tu cartera en una fecha."
              action={<ImportButton />}
            />
            <DataCard
              icon={Upload}
              title="Movimientos y operaciones"
              description="CSV de Actividad. Compras, ventas, dividendos y FCI."
              action={<ImportMovimientosButton />}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <div className="flex flex-col gap-1">
            <h2 className="text-sm font-semibold text-foreground">
              2 · Mantener los datos al día
            </h2>
            <p className="text-xs text-muted-foreground">
              Se actualizan solos todos los días a las 9 (hora de Argentina). Los botones fuerzan
              una actualización en el momento.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <DataCard
              icon={Gauge}
              title="Tipo de cambio CCL"
              description="Se usa para convertir tu portfolio a dólares."
              meta={
                <Suspense fallback={<MetaSkeleton />}>
                  <CclMeta />
                </Suspense>
              }
              action={<CclUpdateButton />}
            />
            <DataCard
              icon={LineChart}
              title="Precios de mercado"
              description="Precios USD de tus subyacentes desde Yahoo Finance."
              meta={
                <Suspense fallback={<MetaSkeleton />}>
                  <MarketPricesMeta />
                </Suspense>
              }
              action={<MarketPricesButton />}
            />
            <DataCard
              icon={TrendingUp}
              title="Inflación y CER"
              description="Índices macro (IPC y CER/UVA) para medir el rendimiento real."
              meta={
                <Suspense fallback={<MetaSkeleton />}>
                  <IndicesMeta />
                </Suspense>
              }
              action={<IndicesUpdateButton />}
            />
          </div>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">
            3 · Datos históricos
          </h2>
          <Suspense fallback={<Skeleton className="h-24 w-full rounded-xl" />}>
            <HistoricalSection />
          </Suspense>
        </section>

        <section className="flex flex-col gap-4">
          <h2 className="text-sm font-semibold text-foreground">
            4 · Objetivos y preferencias
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <PreferenceLink
              icon={Scale}
              title="Rebalanceo"
              description="Definí la asignación objetivo por activo."
              href="/rebalance"
            />
            <PreferenceLink
              icon={Target}
              title="Jubilación"
              description="Configurá tu plan y proyección de retiro."
              href="/retirement"
            />
            <Suspense fallback={null}>
              <MilestonesLink />
            </Suspense>
            <PreferenceLink
              icon={LineChart}
              title="Benchmarks"
              description="Compará tu portfolio contra S&P 500, Merval y NASDAQ."
              href="/performance"
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function MetaSkeleton() {
  return <Skeleton className="h-3 w-40" />;
}

async function SetupSection() {
  const setup = await getSetupStatus();
  return setup.allDone ? (
    <SetupChecklist status={setup} />
  ) : (
    <SetupPanel status={setup} showWizard={false} />
  );
}

async function CclMeta() {
  const rates = await getAllExchangeRates();
  const latestRate = rates.length > 0 ? rates[rates.length - 1] : null;
  if (!latestRate) return <>Sin registros de CCL.</>;
  return (
    <>
      Último: <span className="font-mono text-foreground">
        ${Number(latestRate.ccl).toLocaleString("es-AR")}
      </span>{" "}
      · {fmtDate(latestRate.date)}
    </>
  );
}

async function MarketPricesMeta() {
  const [session, marketPrices] = await Promise.all([getSession(), getMarketPrices()]);
  if (marketPrices.length > 0) {
    const last = marketPrices.reduce((acc, p) => (p.fetchedAt > acc ? p.fetchedAt : acc), marketPrices[0].fetchedAt);
    return (
      <>
        {marketPrices.length} precios · actualizados el {fmtDateTime(new Date(last))}
      </>
    );
  }
  return isAdminRole(session?.user.role) ? (
    <>Sin precios cargados. Completá el subyacente en Assets.</>
  ) : (
    <>Sin precios cargados. Requiere que el administrador complete los subyacentes.</>
  );
}

async function IndicesMeta() {
  const [ipcPoints, cerPoints] = await Promise.all([
    getIndexPoints("inflacion"),
    getIndexPoints("cer"),
  ]);
  if (ipcPoints.length === 0 && cerPoints.length === 0) return <>Sin índices cargados.</>;
  const lastDate = (points: typeof ipcPoints) => (points.length > 0 ? fmtDate(new Date(points[points.length - 1].date)) : "—");
  return (
    <>
      IPC hasta {lastDate(ipcPoints)} · CER hasta {lastDate(cerPoints)}
    </>
  );
}

async function HistoricalSection() {
  const readiness = await getDataReadiness();
  if (readiness.hasSnapshot && readiness.hasTransactions) {
    return <RealGainsWizard readiness={readiness} />;
  }
  return (
    <div className="rounded-xl border border-dashed border-border bg-muted/10 px-5 py-4 flex flex-col sm:flex-row sm:items-center gap-3">
      <div className="flex items-start gap-3 flex-1">
        <Database className="size-4 text-muted-foreground shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {readiness.hasSnapshot
            ? "Para cargar el CCL y los precios históricos falta importar tus movimientos: con ellos sabemos desde qué fecha bajar los datos."
            : "Para cargar el CCL y los precios históricos primero necesitás un snapshot y tus movimientos."}
        </p>
      </div>
      {readiness.hasSnapshot ? <ImportMovimientosButton /> : <ImportButton />}
    </div>
  );
}

async function MilestonesLink() {
  const session = await getSession();
  if (!isAdminRole(session?.user.role)) return null;
  return (
    <PreferenceLink
      icon={Trophy}
      title="Hitos"
      description="Metas de valor en USD que querés celebrar."
      href="/settings"
    />
  );
}
