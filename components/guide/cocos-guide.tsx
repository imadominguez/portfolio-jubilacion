"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useNextStep } from "nextstepjs";
import {
  ArrowLeftRight,
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  PieChart,
  PlayCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PRIMER_USO_TOUR } from "@/lib/onboarding/steps";
import { scrollGuideTourTarget } from "@/lib/onboarding/tour-targets";
import { cn } from "@/lib/utils";

const SNAPSHOT_STEPS = [
  "Iniciá sesión en Cocos Capital.",
  "En el menú lateral, entrá a Portfolio (icono de torta).",
  "Abrí Descargar portfolio.",
  "Seleccioná la fecha del snapshot que querés registrar.",
  "Descargá el archivo en formato CSV (no PDF).",
  "En esta app, usá Importar CSV en Snapshots o el dashboard.",
];

const TRANSACTION_STEPS = [
  "Iniciá sesión en Cocos Capital.",
  "En el menú lateral, entrá a Actividad (icono de barras).",
  "Abrí Descargar movimientos.",
  "Expandí el año y seleccioná el mes o reporte anual que necesitás.",
  "Descargá el archivo en formato CSV (no PDF).",
  "En esta app, andá a Transacciones y usá Importar CSV Cocos.",
];

function GuideSteps({ steps }: { steps: string[] }) {
  return (
    <ol className="relative flex flex-col gap-0">
      {steps.map((step, index) => (
        <li
          key={step}
          className="relative flex gap-4 pb-6 last:pb-0 animate-guide-stagger"
          style={{ animationDelay: `${index * 60}ms` }}
        >
          {index < steps.length - 1 ? (
            <span
              aria-hidden
              className="absolute left-[15px] top-8 bottom-0 w-px bg-border"
            />
          ) : null}
          <span className="relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border border-border bg-card text-xs font-mono font-semibold text-foreground shadow-sm">
            {index + 1}
          </span>
          <p className="pt-1.5 text-sm text-muted-foreground leading-relaxed">{step}</p>
        </li>
      ))}
    </ol>
  );
}

function PhoneScreenshot({
  src,
  alt,
  label,
  priority = false,
}: {
  src: string;
  alt: string;
  label: string;
  priority?: boolean;
}) {
  return (
    <figure
      className="flex flex-col gap-2.5 animate-guide-stagger"
      style={{ animationDelay: "120ms" }}
    >
      <div className="relative mx-auto w-full max-w-[240px] transition-transform duration-500 hover:scale-[1.02]">
        <div className="rounded-[1.75rem] border border-border/80 bg-zinc-950 p-2 shadow-xl ring-1 ring-white/5">
          <div className="overflow-hidden rounded-[1.35rem] bg-zinc-900">
            <Image
              src={src}
              alt={alt}
              width={390}
              height={844}
              priority={priority}
              unoptimized
              className="h-auto w-full transition-opacity duration-500"
            />
          </div>
        </div>
      </div>
      <figcaption className="text-center text-[11px] text-muted-foreground leading-snug px-2">
        {label}
      </figcaption>
    </figure>
  );
}

function GuideSection({
  id,
  badge,
  badgeIcon: BadgeIcon,
  title,
  description,
  steps,
  screenshots,
  importTitle,
  importContent,
  accentClass,
}: {
  id: string;
  badge: string;
  badgeIcon: typeof PieChart;
  title: string;
  description: string;
  steps: string[];
  screenshots: { src: string; alt: string; label: string; priority?: boolean }[];
  importTitle: string;
  importContent: React.ReactNode;
  accentClass: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "scroll-mt-28 overflow-hidden rounded-2xl border border-border bg-card shadow-sm transition-shadow duration-300 hover:shadow-md animate-guide-stagger",
        accentClass
      )}
    >
      <div className="border-b border-border/60 px-6 py-5 sm:px-8">
        <div className="flex flex-wrap items-center gap-3 mb-3">
          <Badge variant="secondary" className="gap-1.5 font-normal">
            <BadgeIcon className="size-3.5" />
            {badge}
          </Badge>
        </div>
        <h2 className="text-xl font-semibold tracking-tight text-foreground">{title}</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground leading-relaxed">
          {description}
        </p>
      </div>

      <div className="grid gap-8 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-start">
        <GuideSteps steps={steps} />
        <div className="flex flex-col gap-6 lg:min-w-[260px]">
          {screenshots.map((shot) => (
            <PhoneScreenshot key={shot.src} {...shot} />
          ))}
        </div>
      </div>

      <div className="mx-6 mb-6 sm:mx-8 sm:mb-8 rounded-xl border border-dashed border-border bg-muted/20 px-5 py-4">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 shrink-0">
            <FileSpreadsheet className="size-4 text-primary" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium text-foreground">{importTitle}</p>
            <div className="text-sm text-muted-foreground leading-relaxed">{importContent}</div>
          </div>
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
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="gap-2"
      onClick={handleRestart}
    >
      <PlayCircle className="size-4" />
      Iniciar tour guiado
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
    <div className="flex flex-col gap-10 animate-fade-up">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-card via-card to-primary/5 px-6 py-8 sm:px-8">
        <div
          aria-hidden
          className="pointer-events-none absolute -right-16 -top-16 size-48 rounded-full bg-primary/10 blur-3xl"
        />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-primary/15 text-primary hover:bg-primary/15 border-0">
              Guía de importación
            </Badge>
            <Badge variant="outline" className="text-muted-foreground">
              Cocos Capital → CSV
            </Badge>
          </div>
          <div className="max-w-2xl flex flex-col gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
              Dos archivos, dos secciones
            </h1>
            <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">
              Cocos exporta archivos <strong className="text-foreground">CSV</strong> (no Excel).
              Cada dato se descarga desde un lugar distinto. Confundir Portfolio con Actividad es
              el error más común al empezar.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <RestartTourButton />
            <Button asChild variant="ghost" size="sm" className="gap-2 text-muted-foreground">
              <a href="https://cocos.capital" target="_blank" rel="noopener noreferrer">
                Abrir Cocos Capital
                <ExternalLink className="size-3.5" />
              </a>
            </Button>
          </div>
        </div>
      </div>

      {/* Comparison cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        <a
          href="#tour-guide-snapshots"
          className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-xl bg-blue-500/10 p-2.5">
              <PieChart className="size-5 text-blue-400" />
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">Portfolio → Snapshots</p>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Estado de tu cartera en una fecha puntual.
          </p>
          <code className="mt-3 inline-block rounded-md bg-muted px-2 py-1 text-[10px] font-mono text-foreground/80">
            portfolio_report_AAAAMMDD.csv
          </code>
        </a>

        <a
          href="#tour-guide-transacciones"
          className="group rounded-xl border border-border bg-card p-5 shadow-sm transition-all hover:border-primary/30 hover:shadow-md"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="rounded-xl bg-emerald-500/10 p-2.5">
              <ArrowLeftRight className="size-5 text-emerald-400" />
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
          </div>
          <p className="mt-4 text-sm font-semibold text-foreground">Actividad → Transacciones</p>
          <p className="mt-1.5 text-xs text-muted-foreground leading-relaxed">
            Compras, ventas y operaciones del período.
          </p>
          <code className="mt-3 inline-block rounded-md bg-muted px-2 py-1 text-[10px] font-mono text-foreground/80">
            movements_report_YYYY-MM-DD_YYYY-MM-DD.csv
          </code>
        </a>
      </div>

      {/* Quick checklist */}
      <div className="flex flex-wrap gap-x-6 gap-y-2 rounded-xl border border-border/60 bg-muted/10 px-5 py-4">
        {[
          "Descargá CSV, no PDF",
          "Portfolio ≠ Actividad",
          "Importá snapshots y transacciones por separado",
        ].map((tip) => (
          <span key={tip} className="flex items-center gap-2 text-xs text-muted-foreground">
            <CheckCircle2 className="size-3.5 shrink-0 text-emerald-500" />
            {tip}
          </span>
        ))}
      </div>

      <GuideSection
        id="tour-guide-snapshots"
        badge="Snapshots"
        badgeIcon={CalendarDays}
        title="Descargar snapshot desde Portfolio"
        description="Usá esta guía cuando quieras registrar el valor y composición de tu cartera en una fecha específica. En Cocos, Portfolio y Actividad son secciones distintas del menú lateral."
        steps={SNAPSHOT_STEPS}
        accentClass="ring-1 ring-blue-500/10"
        screenshots={[
          {
            src: "/guides/cocos/menu-lateral.png",
            alt: "Menú lateral de Cocos con Portfolio resaltado",
            label: "Menú lateral — sección Portfolio",
            priority: true,
          },
          {
            src: "/guides/cocos/descargar-portfolio.png",
            alt: "Modal Descargar portfolio en Cocos con botón CSV",
            label: "Descargar portfolio → botón CSV",
          },
        ]}
        importTitle="Importar en Portfolio Jubilación"
        importContent={
          <>
            Andá a{" "}
            <Link href="/snapshots" className="text-primary underline-offset-4 hover:underline">
              Snapshots
            </Link>{" "}
            o al dashboard y usá <strong className="text-foreground">Importar CSV</strong>. El
            sistema detecta la fecha desde el nombre del archivo.
          </>
        }
      />

      <GuideSection
        id="tour-guide-transacciones"
        badge="Transacciones"
        badgeIcon={ArrowLeftRight}
        title="Descargar movimientos desde Actividad"
        description="Usá esta guía para importar compras, ventas y operaciones. Este archivo no sirve para snapshots: viene de Actividad, no de Portfolio."
        steps={TRANSACTION_STEPS}
        accentClass="ring-1 ring-emerald-500/10"
        screenshots={[
          {
            src: "/guides/cocos/menu-lateral.png",
            alt: "Menú lateral de Cocos con Actividad",
            label: "Menú lateral — sección Actividad",
          },
          {
            src: "/guides/cocos/descargar-movimientos.png",
            alt: "Modal Descargar movimientos en Cocos con botón CSV",
            label: "Descargar movimientos → botón CSV",
          },
        ]}
        importTitle="Importar en Portfolio Jubilación"
        importContent={
          <>
            Andá a{" "}
            <Link href="/transactions" className="text-primary underline-offset-4 hover:underline">
              Transacciones
            </Link>{" "}
            y usá <strong className="text-foreground">Importar CSV Cocos</strong>. Podés importar
            varios meses; el sistema omite duplicados automáticamente.
          </>
        }
      />
    </div>
  );
}
