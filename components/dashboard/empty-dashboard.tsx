import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Upload } from "lucide-react";

export function EmptyDashboard() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-8 px-6 animate-fade-up">
      <div className="flex flex-col items-center gap-6 text-center max-w-sm">
        <div className="relative">
          <div className="size-16 rounded-2xl border border-border/50 bg-muted/30 flex items-center justify-center">
            <Upload className="size-6 text-muted-foreground" />
          </div>
          <div className="absolute -top-1 -right-1 size-3 rounded-full bg-muted-foreground/20 border border-border/50" />
        </div>

        <div className="flex flex-col gap-2">
          <p className="text-base font-medium text-foreground">
            Sin datos de portfolio
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Exportá tu cartera desde{" "}
            <span className="text-foreground font-medium">Cocos Capital</span> en
            formato CSV e importala para comenzar a registrar el historial de
            tu portfolio.
          </p>
        </div>

        <Button variant="outline" size="sm" className="gap-2">
          <Upload className="size-3.5" data-icon="inline-start" />
          Importar primer snapshot
        </Button>
      </div>

      <Separator className="max-w-xs opacity-30" />

      <div className="grid grid-cols-3 gap-8 text-center max-w-sm">
        {[
          { step: "01", label: "Exportá el CSV desde Cocos Capital" },
          { step: "02", label: "Importalo aquí para registrar el estado" },
          { step: "03", label: "Repetí mensualmente para ver el historial" },
        ].map(({ step, label }) => (
          <div key={step} className="flex flex-col gap-2">
            <span className="text-[10px] font-mono font-medium tracking-widest text-muted-foreground/50">
              {step}
            </span>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {label}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
