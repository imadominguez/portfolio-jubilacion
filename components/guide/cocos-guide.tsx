"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useEffect, useRef, useState, useTransition } from "react";
import { useNextStep } from "nextstepjs";
import {
  ArrowLeftRight,
  ArrowRight,
  BarChart3,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  FileText,
  PieChart,
  PlayCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PRIMER_USO_TOUR } from "@/lib/onboarding/steps";
import { scrollGuideTourTarget } from "@/lib/onboarding/tour-targets";
import { restartOnboarding } from "@/app/actions/setup";
import { cn } from "@/lib/utils";
import { CocosMockup, type CocosRoute, type CocosScreen } from "./cocos-mockup";

type GuideStep = {
  title: string;
  detail: string;
  screen: CocosScreen;
  screenDescription: string;
};

const SNAPSHOT_STEPS: GuideStep[] = [
  {
    title: "Entrá a Portfolio",
    detail: "Es el ícono de torta del menú lateral. No es Actividad.",
    screen: { kind: "menu" },
    screenDescription: "Menú lateral de Cocos con Portfolio resaltado.",
  },
  {
    title: "Abrí Descargar portfolio",
    detail: "Se abre el panel para elegir fecha y formato.",
    screen: { kind: "page" },
    screenDescription: "Pantalla Portfolio con la opción Descargar portfolio resaltada.",
  },
  {
    title: "Elegí la fecha",
    detail: "Es la fecha del snapshot. La app la lee del nombre del archivo.",
    screen: { kind: "sheet", target: "date" },
    screenDescription: "Panel Descargar portfolio con el campo de fecha resaltado.",
  },
  {
    title: "Descargá en CSV",
    detail: "El PDF no se puede importar.",
    screen: { kind: "sheet", target: "csv" },
    screenDescription: "Panel Descargar portfolio con el botón CSV resaltado.",
  },
];

const TRANSACTION_STEPS: GuideStep[] = [
  {
    title: "Entrá a Actividad",
    detail: "Es el ícono de barras del menú lateral. No es Portfolio.",
    screen: { kind: "menu" },
    screenDescription: "Menú lateral de Cocos con Actividad resaltado.",
  },
  {
    title: "Abrí Descargar movimientos",
    detail: "Se abre el panel con los períodos disponibles.",
    screen: { kind: "page" },
    screenDescription: "Pantalla Actividad con la opción Descargar movimientos resaltada.",
  },
  {
    title: "Elegí el período",
    detail: "Expandí el año y elegí un mes o el reporte anual.",
    screen: { kind: "sheet", target: "period" },
    screenDescription: "Panel Descargar movimientos con un mes resaltado.",
  },
  {
    title: "Descargá en CSV",
    detail: "El PDF no se puede importar.",
    screen: { kind: "sheet", target: "csv" },
    screenDescription: "Panel Descargar movimientos con el botón CSV resaltado.",
  },
];

// Portfolio y Actividad llevan colores distintos en toda la página porque
// confundirlos es el error más común; el verde queda reservado a ganancias.
const ROUTE_STYLE: Record<CocosRoute, { text: string; soft: string; border: string; marker: string }> = {
  portfolio: {
    text: "text-primary",
    soft: "bg-primary/10",
    border: "border-primary/40",
    marker: "bg-primary text-primary-foreground",
  },
  actividad: {
    text: "text-chart-2",
    soft: "bg-chart-2/10",
    border: "border-chart-2/40",
    marker: "bg-chart-2 text-background",
  },
};

const ROUTES = [
  {
    route: "portfolio" as const,
    href: "#tour-guide-snapshots",
    from: "Portfolio",
    fromIcon: PieChart,
    file: "portfolio_report_AAAAMMDD.csv",
    to: "Snapshots",
    what: "Tu cartera en una fecha",
  },
  {
    route: "actividad" as const,
    href: "#tour-guide-transacciones",
    from: "Actividad",
    fromIcon: BarChart3,
    file: "movements_report_AAAA-MM-DD_AAAA-MM-DD.csv",
    to: "Transacciones",
    what: "Compras, ventas y otras operaciones",
  },
];

// Los breakpoints son container queries (@xl, @2xl) y no de viewport: desde
// 768px aparece el sidebar y el ancho real de la guía en tablet es ~500px.
function RouteMap() {
  return (
    <nav aria-label="Qué archivo descargar" className="flex flex-col gap-2">
      {ROUTES.map(({ route, href, from, fromIcon: FromIcon, file, to, what }) => {
        const style = ROUTE_STYLE[route];
        return (
          <a
            key={route}
            href={href}
            className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 rounded-xl border border-border bg-card px-4 py-3.5 transition-colors duration-150 hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 @2xl:grid-cols-[8.5rem_minmax(0,1fr)_auto_8.5rem] @2xl:px-5"
          >
            <span className={cn("flex items-center gap-2 text-sm font-semibold", style.text)}>
              <span className={cn("rounded-lg p-1.5", style.soft)}>
                <FromIcon className="size-4" />
              </span>
              {from}
            </span>
            <span className="order-3 col-span-2 min-w-0 @2xl:order-0 @2xl:col-span-1">
              {/* En angosto el nombre se parte en vez de truncarse (es lo que hay que
                  reconocer en Descargas), y solo después de "_" para no cortar ".csv". */}
              <code className="block font-mono text-xs text-foreground/85 @2xl:truncate">
                {file.split("_").map((part, index, parts) => (
                  <Fragment key={index}>
                    <span className="whitespace-nowrap">{part}</span>
                    {index < parts.length - 1 ? (
                      <>
                        _<wbr />
                      </>
                    ) : null}
                  </Fragment>
                ))}
              </code>
              <span className="mt-0.5 block text-xs text-muted-foreground">{what}</span>
            </span>
            <ArrowRight
              aria-hidden
              className="hidden size-4 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 @2xl:block"
            />
            <span className="order-2 flex items-center gap-1.5 text-sm font-medium text-foreground @2xl:order-0">
              <ArrowRight aria-hidden className="size-3.5 text-muted-foreground @2xl:hidden" />
              {to}
            </span>
          </a>
        );
      })}
    </nav>
  );
}

function StepList({
  steps,
  active,
  onSelect,
  route,
}: {
  steps: GuideStep[];
  active: number;
  onSelect: (index: number) => void;
  route: CocosRoute;
}) {
  const style = ROUTE_STYLE[route];
  return (
    <ol className="flex flex-col gap-1.5">
      {steps.map((step, index) => {
        const selected = index === active;
        return (
          <li key={step.title}>
            <button
              type="button"
              aria-pressed={selected}
              onClick={() => onSelect(index)}
              onMouseEnter={() => onSelect(index)}
              onFocus={() => onSelect(index)}
              className={cn(
                "flex w-full items-start gap-3 rounded-xl border px-3 py-3 text-left transition-colors duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                selected ? [style.border, style.soft] : "border-transparent hover:bg-muted/40"
              )}
            >
              <span
                className={cn(
                  "flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-[11px] font-semibold tabular-nums transition-colors duration-150",
                  selected ? style.marker : "bg-muted text-muted-foreground"
                )}
              >
                {index + 1}
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-foreground">{step.title}</span>
                <span className="text-sm leading-relaxed text-muted-foreground">{step.detail}</span>
              </span>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

const SWIPE_THRESHOLD_PX = 40;

// En angosto, el esquema y el texto del paso tienen que verse juntos: con la
// lista arriba y el celular abajo, tocar un paso cambiaba algo fuera de pantalla.
function StepViewer({
  steps,
  active,
  onSelect,
  route,
}: {
  steps: GuideStep[];
  active: number;
  onSelect: (index: number) => void;
  route: CocosRoute;
}) {
  const style = ROUTE_STYLE[route];
  const current = steps[active];
  const isFirst = active === 0;
  const isLast = active === steps.length - 1;
  const touchStartX = useRef<number | null>(null);

  function handleTouchEnd(event: React.TouchEvent) {
    if (touchStartX.current === null) return;
    const dx = event.changedTouches[0].clientX - touchStartX.current;
    touchStartX.current = null;
    if (dx <= -SWIPE_THRESHOLD_PX && !isLast) onSelect(active + 1);
    if (dx >= SWIPE_THRESHOLD_PX && !isFirst) onSelect(active - 1);
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="w-full touch-pan-y"
        onTouchStart={(event) => {
          touchStartX.current = event.touches[0].clientX;
        }}
        onTouchEnd={handleTouchEnd}
      >
        <CocosMockup
          route={route}
          screen={current.screen}
          description={current.screenDescription}
          className="max-w-[200px]"
        />
      </div>

      <ol className="flex items-center gap-2" aria-label="Pasos">
        {steps.map((step, index) => {
          const selected = index === active;
          return (
            <li key={step.title}>
              <button
                type="button"
                aria-label={`Paso ${index + 1}: ${step.title}`}
                aria-current={selected ? "step" : undefined}
                onClick={() => onSelect(index)}
                className={cn(
                  "flex size-9 items-center justify-center rounded-full font-mono text-xs font-semibold tabular-nums transition-colors duration-150 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  selected ? style.marker : "bg-muted text-muted-foreground hover:text-foreground"
                )}
              >
                {index + 1}
              </button>
            </li>
          );
        })}
      </ol>

      {/* min-h fijo: que los botones no salten al cambiar entre pasos de 1 y 2 líneas. */}
      <div aria-live="polite" className="flex min-h-[4.5rem] max-w-[34ch] flex-col items-center gap-1 text-center">
        <p className="text-sm font-medium text-foreground">{current.title}</p>
        <p className="text-sm leading-relaxed text-muted-foreground">{current.detail}</p>
      </div>

      <div className="grid w-full grid-cols-2 gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelect(active - 1)}
          disabled={isFirst}
          className="gap-1.5"
        >
          <ChevronLeft className="size-4" />
          Anterior
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => onSelect(active + 1)}
          disabled={isLast}
          className="gap-1.5"
        >
          Siguiente
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function GuideSection({
  id,
  route,
  icon: Icon,
  title,
  description,
  steps,
  importHref,
  importLabel,
  importNote,
}: {
  id: string;
  route: CocosRoute;
  icon: typeof PieChart;
  title: string;
  description: string;
  steps: GuideStep[];
  importHref: string;
  importLabel: string;
  importNote: string;
}) {
  const [active, setActive] = useState(0);
  const style = ROUTE_STYLE[route];
  const current = steps[active];

  return (
    <section
      id={id}
      aria-labelledby={`${id}-title`}
      className="scroll-mt-28 rounded-2xl border border-border bg-card"
    >
      <header className="grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-2 border-b border-border/60 px-4 py-4 @xl:px-7 @xl:py-5">
        <span className={cn("rounded-lg p-2", style.soft)}>
          <Icon className={cn("size-4", style.text)} />
        </span>
        <h2 id={`${id}-title`} className="text-lg font-semibold tracking-tight text-foreground">
          {title}
        </h2>
        {/* En angosto ocupa todo el ancho; desde @xl se alinea con el título. */}
        <p className="col-span-2 max-w-[62ch] text-sm leading-relaxed text-muted-foreground @xl:col-span-1 @xl:col-start-2">
          {description}
        </p>
      </header>

      <div className="flex flex-col gap-6 px-4 py-5 @xl:px-7 @xl:py-6">
        {/* Se renderizan los dos layouts y el contenedor elige (display: none los saca
            del árbol de accesibilidad); comparten el estado del paso activo. */}
        <div className="@2xl:hidden">
          <StepViewer steps={steps} active={active} onSelect={setActive} route={route} />
        </div>
        <div className="hidden gap-12 @2xl:grid @2xl:grid-cols-[1fr_220px] @2xl:items-start">
          <StepList steps={steps} active={active} onSelect={setActive} route={route} />
          <div className="sticky top-24">
            <CocosMockup route={route} screen={current.screen} description={current.screenDescription} />
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-xl bg-muted/40 px-4 py-4 @xl:flex-row @xl:items-center @xl:justify-between">
          <div className="flex items-start gap-3">
            <FileText className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
            <p className="text-sm leading-relaxed text-muted-foreground">
              <span className="font-medium text-foreground">Con el CSV descargado:</span> {importNote}
            </p>
          </div>
          <Button asChild className="w-full shrink-0 gap-1.5 @xl:w-auto">
            <Link href={importHref}>
              {importLabel}
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

export function RestartTourButton() {
  const router = useRouter();
  const { startNextStep, isNextStepVisible } = useNextStep();

  function handleRestart() {
    if (isNextStepVisible) return;
    router.push("/");
    window.setTimeout(() => startNextStep(PRIMER_USO_TOUR), 400);
  }

  return (
    <Button type="button" variant="outline" size="sm" className="gap-2" onClick={handleRestart}>
      <PlayCircle className="size-4" />
      Iniciar tour guiado
    </Button>
  );
}

export function RestartOnboardingButton() {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleRestart() {
    startTransition(async () => {
      await restartOnboarding();
      router.push("/");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="gap-2 text-muted-foreground"
      onClick={handleRestart}
      disabled={isPending}
    >
      <Sparkles className="size-4" />
      Repetir guía de inicio
    </Button>
  );
}

export function CocosGuide() {
  useEffect(() => {
    const hash = window.location.hash.replace("#", "");
    if (hash !== "snapshots" && hash !== "transacciones") return;

    const targetId = hash === "snapshots" ? "tour-guide-snapshots" : "tour-guide-transacciones";
    scrollGuideTourTarget(targetId);
  }, []);

  return (
    <div className="@container flex flex-col gap-8 animate-fade-up @xl:gap-10">
      <div className="flex flex-col gap-5">
        <div className="flex max-w-[62ch] flex-col gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-foreground @xl:text-3xl">
            Dos archivos, dos lugares de Cocos
          </h1>
          <p className="text-sm leading-relaxed text-muted-foreground @xl:text-base">
            El estado de tu cartera sale de <span className="text-foreground">Portfolio</span>; tus
            operaciones, de <span className="text-foreground">Actividad</span>. Cada uno se importa en
            una sección distinta de esta app.
          </p>
        </div>

        <RouteMap />

        <div className="flex flex-col gap-3 border-t border-border/60 pt-4 @3xl:flex-row @3xl:items-center @3xl:justify-between">
          <p className="text-sm text-muted-foreground">
            Para los dos: iniciá sesión en Cocos y descargá siempre en{" "}
            <span className="font-medium text-foreground">CSV</span>, nunca en PDF.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" size="sm" className="gap-2">
              <a href="https://cocos.capital" target="_blank" rel="noopener noreferrer">
                Abrir Cocos
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
            <RestartTourButton />
            <RestartOnboardingButton />
          </div>
        </div>
      </div>

      <GuideSection
        id="tour-guide-snapshots"
        route="portfolio"
        icon={CalendarDays}
        title="Snapshot desde Portfolio"
        description="Registra el valor y la composición de tu cartera en una fecha. Descargá uno por cada fecha que quieras seguir, por ejemplo a fin de mes."
        steps={SNAPSHOT_STEPS}
        importHref="/snapshots"
        importLabel="Importar en Snapshots"
        importNote="usá Importar CSV en Snapshots o en el Dashboard."
      />

      <GuideSection
        id="tour-guide-transacciones"
        route="actividad"
        icon={ArrowLeftRight}
        title="Movimientos desde Actividad"
        description="Trae compras, ventas y otras operaciones, que alimentan el precio promedio y la ganancia realizada. Este archivo no sirve para snapshots."
        steps={TRANSACTION_STEPS}
        importHref="/transactions"
        importLabel="Importar en Transacciones"
        importNote="usá Importar CSV Cocos. Podés importar varios meses: los duplicados se omiten solos."
      />
    </div>
  );
}
