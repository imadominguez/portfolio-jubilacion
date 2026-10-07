import { BarChart3, CalendarDays, ChevronDown, ChevronRight, Download, Menu, PieChart } from "lucide-react";
import { cn } from "@/lib/utils";

// Esquemas de Cocos dibujados con tokens en vez de capturas: siguen el tema,
// no exponen datos de una cuenta real y no quedan desactualizados en silencio
// (lo que no sabemos de la UI de Cocos va como bloque neutro, no inventado).

export type CocosRoute = "portfolio" | "actividad";

export type CocosScreen =
  | { kind: "menu" }
  | { kind: "page" }
  | { kind: "sheet"; target: "date" | "period" | "csv" };

const ROUTE = {
  portfolio: {
    label: "Portfolio",
    icon: PieChart,
    sheetTitle: "Descargar portfolio",
    ring: "ring-primary",
    text: "text-primary",
    fill: "bg-primary",
    soft: "bg-primary/15",
  },
  actividad: {
    label: "Actividad",
    icon: BarChart3,
    sheetTitle: "Descargar movimientos",
    ring: "ring-chart-2",
    text: "text-chart-2",
    fill: "bg-chart-2",
    soft: "bg-chart-2/15",
  },
} as const;

function Highlight({
  on,
  route,
  className,
  children,
}: {
  on: boolean;
  route: CocosRoute;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn(
        "relative transition-shadow duration-200",
        on && ["ring-2 ring-offset-2 ring-offset-background", ROUTE[route].ring],
        className
      )}
    >
      {children}
      {on ? (
        <span aria-hidden className="absolute -right-1 -top-1 flex size-2.5">
          <span
            className={cn(
              "absolute inline-flex size-full rounded-full opacity-60 motion-safe:animate-ping",
              ROUTE[route].fill
            )}
          />
          <span className={cn("relative inline-flex size-2.5 rounded-full", ROUTE[route].fill)} />
        </span>
      ) : null}
    </div>
  );
}

function Placeholder({ className }: { className?: string }) {
  return <span aria-hidden className={cn("block h-1.5 rounded-full bg-muted-foreground/20", className)} />;
}

function TopBar({ title }: { title?: string }) {
  return (
    <div className="flex items-center gap-2 border-b border-border/60 px-3 py-2.5">
      <Menu className="size-3.5 text-muted-foreground" />
      {title ? (
        <span className="text-[11px] font-semibold text-foreground">{title}</span>
      ) : (
        <Placeholder className="w-12" />
      )}
    </div>
  );
}

function PageBody() {
  return (
    <div className="flex flex-col gap-3 px-3 py-3">
      <Placeholder className="h-2.5 w-20 bg-muted-foreground/30" />
      <Placeholder className="w-28" />
      <div className="mt-1 flex flex-col gap-2.5">
        {[0, 1, 2, 3].map((row) => (
          <div key={row} className="flex items-center justify-between">
            <Placeholder className="w-14" />
            <Placeholder className="w-8" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MenuScreen({ route }: { route: CocosRoute }) {
  return (
    <div className="relative h-full">
      <div aria-hidden className="opacity-40">
        <TopBar />
        <PageBody />
      </div>
      <div className="absolute inset-y-0 left-0 flex w-[78%] flex-col gap-1 border-r border-border bg-popover px-2 py-3 shadow-lg">
        <Placeholder className="mx-1.5 mb-3 w-10" />
        <MenuItemPlaceholder />
        {(["portfolio", "actividad"] as const).map((item) => {
          const { icon: Icon, label } = ROUTE[item];
          const active = item === route;
          return (
            <Highlight key={item} on={active} route={route} className="rounded-md">
              <div
                className={cn(
                  "flex items-center gap-2 rounded-md px-2 py-1.5 text-[11px]",
                  active ? [ROUTE[route].soft, "font-semibold text-foreground"] : "text-muted-foreground"
                )}
              >
                <Icon className={cn("size-3.5", active ? ROUTE[route].text : "text-muted-foreground")} />
                {label}
              </div>
            </Highlight>
          );
        })}
        <MenuItemPlaceholder />
        <MenuItemPlaceholder />
      </div>
    </div>
  );
}

function MenuItemPlaceholder() {
  return (
    <div className="flex items-center gap-2 px-2 py-2">
      <span aria-hidden className="size-3.5 rounded-sm bg-muted-foreground/20" />
      <Placeholder className="w-12" />
    </div>
  );
}

function PageScreen({ route }: { route: CocosRoute }) {
  const { label, sheetTitle } = ROUTE[route];
  return (
    <div>
      <TopBar title={label} />
      <div className="px-3 pt-3">
        <Highlight on route={route} className="rounded-md">
          <div className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2 py-1.5 text-[10px] font-medium text-foreground">
            <Download className="size-3" />
            {sheetTitle}
          </div>
        </Highlight>
      </div>
      <PageBody />
    </div>
  );
}

function SheetScreen({ route, target }: { route: CocosRoute; target: "date" | "period" | "csv" }) {
  const { label, sheetTitle } = ROUTE[route];
  return (
    <div className="relative h-full">
      <div aria-hidden className="opacity-30">
        <TopBar title={label} />
        <PageBody />
      </div>
      <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 rounded-t-xl border-t border-border bg-popover px-3 pb-4 pt-2 shadow-lg">
        <span aria-hidden className="mx-auto h-1 w-8 rounded-full bg-muted-foreground/30" />
        <p className="text-[11px] font-semibold text-foreground">{sheetTitle}</p>

        {route === "portfolio" ? (
          <Highlight on={target === "date"} route={route} className="rounded-md">
            <div className="flex items-center justify-between rounded-md border border-border bg-background px-2 py-1.5 text-[10px] text-muted-foreground">
              Fecha
              <CalendarDays className="size-3" />
            </div>
          </Highlight>
        ) : (
          <div className="flex flex-col gap-1 text-[10px]">
            <div className="flex items-center gap-1 font-medium text-foreground">
              <ChevronDown className="size-3" />
              Año en curso
            </div>
            <div className="flex flex-col gap-1 pl-4">
              <Highlight on={target === "period"} route={route} className="rounded-sm">
                <div className="rounded-sm px-1 py-0.5 text-foreground">Un mes</div>
              </Highlight>
              <div className="px-1 text-muted-foreground">Reporte anual</div>
            </div>
            <div className="flex items-center gap-1 text-muted-foreground">
              <ChevronRight className="size-3" />
              Años anteriores
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-2 text-[10px] font-semibold">
          <div className="rounded-md border border-border px-2 py-1.5 text-center text-muted-foreground line-through decoration-muted-foreground/60">
            PDF
          </div>
          <Highlight on={target === "csv"} route={route} className="rounded-md">
            <div className={cn("rounded-md px-2 py-1.5 text-center text-background", ROUTE[route].fill)}>
              CSV
            </div>
          </Highlight>
        </div>
      </div>
    </div>
  );
}

export function CocosMockup({
  route,
  screen,
  description,
  className,
}: {
  route: CocosRoute;
  screen: CocosScreen;
  description: string;
  className?: string;
}) {
  return (
    <figure className={cn("mx-auto flex w-full max-w-[220px] flex-col gap-2", className)}>
      <div className="rounded-[1.75rem] border border-border bg-muted p-1.5 shadow-sm">
        <div
          role="img"
          aria-label={description}
          className="relative aspect-[9/16] overflow-hidden rounded-[1.35rem] bg-background"
        >
          {/* key: re-monta la pantalla para que el cambio de paso se lea como transición. */}
          <div key={JSON.stringify(screen)} className="h-full animate-fade-in">
            {screen.kind === "menu" ? <MenuScreen route={route} /> : null}
            {screen.kind === "page" ? <PageScreen route={route} /> : null}
            {screen.kind === "sheet" ? <SheetScreen route={route} target={screen.target} /> : null}
          </div>
        </div>
      </div>
      <figcaption className="text-center text-[11px] text-muted-foreground">
        Esquema simplificado de Cocos
      </figcaption>
    </figure>
  );
}
