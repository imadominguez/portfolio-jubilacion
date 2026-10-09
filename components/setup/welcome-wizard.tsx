"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Circle,
  Compass,
  Database,
  FileSpreadsheet,
  Layers,
  Sparkles,
  Target,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import {
  completeOnboarding,
  dismissOnboarding,
  setOnboardingStep,
} from "@/app/actions/setup";
import type { SetupStatus, SetupStepId } from "@/lib/setup-status";

type WizardAction =
  | { kind: "snapshot-import" }
  | { kind: "navigate"; href: string };

type WizardStep = {
  key: string;
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
  setupId?: SetupStepId;
  action?: { label: string } & WizardAction;
};

const WIZARD_STEPS: WizardStep[] = [
  {
    key: "welcome",
    icon: Compass,
    title: "Bienvenido a Portfolio Jubilación",
    body: (
      <>
        Esta app hace seguimiento de tu cartera de CEDEARs de Cocos Capital a lo
        largo del tiempo. Te guiamos para cargar tus datos en orden: con el{" "}
        <strong>primer paso</strong> ya ves tu dashboard; el resto suma métricas.
        Podés hacerlo ahora o más tarde.
      </>
    ),
  },
  {
    key: "snapshot",
    icon: FileSpreadsheet,
    title: "1 · Importá tu primer snapshot",
    body: (
      <>
        El CSV de <strong>Portfolio</strong> (no Actividad) en Cocos Capital.
        Es el estado de tu cartera en una fecha y desbloquea el dashboard.
      </>
    ),
    setupId: "snapshot",
    action: { kind: "snapshot-import", label: "Importar snapshot" },
  },
  {
    key: "assets",
    icon: Layers,
    title: "2 · Completá tus activos",
    body: (
      <>
        Al importar el snapshot detectamos tus tickers. Sólo falta el{" "}
        <strong>ratio CEDEAR</strong>, el subyacente, sector y país. Habilita USD
        en vivo, Concentración y Ganancia Real.
      </>
    ),
    setupId: "assets",
    action: { kind: "navigate", href: "/assets", label: "Completar activos" },
  },
  {
    key: "transactions",
    icon: Database,
    title: "3 · Registrá tus movimientos",
    body: (
      <>
        El CSV de <strong>Actividad</strong> de Cocos. Habilita el precio
        promedio de compra (PPM) y el P&amp;L de tus posiciones.
      </>
    ),
    setupId: "transactions",
    action: { kind: "navigate", href: "/transactions", label: "Importar movimientos" },
  },
  {
    key: "historicals",
    icon: Database,
    title: "4 · Cargá los históricos",
    body: (
      <>
        CCL y precios de acciones desde tu primera compra. Es lo que permite
        separar la ganancia real en USD del efecto del tipo de cambio.
      </>
    ),
    setupId: "historicals",
    action: { kind: "navigate", href: "/real-gains", label: "Cargar históricos" },
  },
  {
    key: "preferences",
    icon: Target,
    title: "5 · Definí tu plan de retiro",
    body: (
      <>
        Tu edad, los gastos que querés cubrir y el <strong>aporte mensual</strong>. Con eso
        Jubilación proyecta si llegás a la meta.
      </>
    ),
    setupId: "preferences",
    action: { kind: "navigate", href: "/retirement", label: "Configurar jubilación" },
  },
  {
    key: "finish",
    icon: Sparkles,
    title: "¡Listo!",
    body: (
      <>
        Ya sabés cómo completar tu portfolio. Podés retomar cualquier paso desde
        el <strong>Centro de Datos</strong> o el checklist del dashboard.
      </>
    ),
  },
];

type WelcomeWizardProps = {
  status: SetupStatus;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** El padre cierra el wizard y abre el import de snapshot. */
  onRequestSnapshotImport: () => void;
};

export function WelcomeWizard({
  status,
  open,
  onOpenChange,
  onRequestSnapshotImport,
}: WelcomeWizardProps) {
  const router = useRouter();
  const [index, setIndex] = useState(() => {
    const resume = status.onboarding.lastStep;
    if (!resume) return 0;
    const found = WIZARD_STEPS.findIndex((s) => s.setupId === resume);
    return found >= 0 ? found : 0;
  });
  const [pending, setPending] = useState(false);

  const doneById = useMemo(() => {
    const map = new Map<SetupStepId, boolean>();
    for (const s of status.steps) map.set(s.id, s.done);
    return map;
  }, [status.steps]);

  const step = WIZARD_STEPS[index];
  const isLast = index === WIZARD_STEPS.length - 1;
  const Icon = step.icon;
  const setupStep = step.setupId
    ? status.steps.find((s) => s.id === step.setupId)
    : undefined;
  const isActionable = setupStep?.actionable ?? true;

  function goTo(next: number) {
    const clamped = Math.max(0, Math.min(WIZARD_STEPS.length - 1, next));
    setIndex(clamped);
    const setupId = WIZARD_STEPS[clamped].setupId;
    if (setupId) void setOnboardingStep(setupId);
  }

  async function handleFinish() {
    setPending(true);
    await completeOnboarding();
    setPending(false);
    onOpenChange(false);
  }

  async function handleLater() {
    setPending(true);
    const setupId = step.setupId;
    if (setupId) await setOnboardingStep(setupId);
    setPending(false);
    onOpenChange(false);
  }

  async function handleDismiss() {
    setPending(true);
    await dismissOnboarding();
    setPending(false);
    onOpenChange(false);
  }

  function handleAction() {
    if (!step.action) return;
    if (step.action.kind === "snapshot-import") {
      onOpenChange(false);
      onRequestSnapshotImport();
      return;
    }
    onOpenChange(false);
    router.push(step.action.href);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg gap-0 p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 border border-primary/20 shrink-0">
              <Icon className="size-4 text-primary" />
            </div>
            <div className="flex flex-col min-w-0">
              <DialogTitle className="text-sm font-semibold">
                {step.title}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Paso {index + 1} de {WIZARD_STEPS.length}
              </DialogDescription>
            </div>
          </div>
          <Progress
            value={((index + 1) / WIZARD_STEPS.length) * 100}
            className="mt-4"
          />
        </DialogHeader>

        <div className="px-6 py-5 flex flex-col gap-5">
          <div className="text-sm text-muted-foreground leading-relaxed">
            {isActionable ? step.body : setupStep?.description}
          </div>

          {step.setupId && (
            <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-2">
              {doneById.get(step.setupId) ? (
                <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
              ) : (
                <Circle className="size-4 text-muted-foreground/40 shrink-0" />
              )}
              <span className="text-xs text-muted-foreground">
                {doneById.get(step.setupId)
                  ? "Este paso ya está completo."
                  : isActionable
                    ? "Todavía pendiente."
                    : "Lo configura el administrador; no necesitás hacer nada."}
              </span>
            </div>
          )}

          {step.action && isActionable && (
            <Button
              onClick={handleAction}
              className="w-full gap-2"
              variant={doneById.get(step.setupId ?? "snapshot") ? "outline" : "default"}
            >
              {step.action.label}
              <ArrowRight className="size-3.5" />
            </Button>
          )}
        </div>

        <div className="px-6 py-4 border-t border-border/40 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => goTo(index - 1)}
              disabled={index === 0 || pending}
              className="gap-1.5 text-xs text-muted-foreground"
            >
              <ArrowLeft className="size-3" />
              Anterior
            </Button>
          </div>

          <div className="flex items-center gap-1.5">
            {!isLast ? (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleDismiss}
                  disabled={pending}
                  className="text-xs text-muted-foreground"
                >
                  No mostrar más
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleLater}
                  disabled={pending}
                  className="text-xs text-muted-foreground"
                >
                  Más tarde
                </Button>
                <Button size="sm" onClick={() => goTo(index + 1)} disabled={pending}>
                  Siguiente
                </Button>
              </>
            ) : (
              <Button size="sm" onClick={handleFinish} disabled={pending}>
                Finalizar
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
