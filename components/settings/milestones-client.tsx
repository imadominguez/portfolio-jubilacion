"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2, Trophy, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import type { MilestoneRow } from "@/app/actions/milestones";
import { createMilestone, deleteMilestone } from "@/app/actions/milestones";

interface MilestonesClientProps {
  initialMilestones: MilestoneRow[];
  currentPortfolioUsd: number | null;
}

function formatUSD(v: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(v);
}

export function MilestonesClient({
  initialMilestones,
  currentPortfolioUsd,
}: MilestonesClientProps) {
  const [milestones, setMilestones] = useState(initialMilestones);
  const [addOpen, setAddOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [targetUsd, setTargetUsd] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    startTransition(async () => {
      const result = await createMilestone(label, parseFloat(targetUsd));
      if (result.success) {
        toast.success("Hito creado");
        setLabel("");
        setTargetUsd("");
        setAddOpen(false);
      } else {
        toast.error(result.error);
      }
    });
  }

  function handleDelete(id: string) {
    if (!id) return;
    startTransition(async () => {
      const result = await deleteMilestone(id);
      if (result.success) {
        setMilestones((prev) => prev.filter((m) => m.id !== id));
        toast.success("Hito eliminado");
      } else {
        toast.error(result.error);
      }
    });
  }

  const reachedCount = milestones.filter((m) => m.reached).length;
  const nextMilestone = milestones.find((m) => !m.reached);

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
            Hitos del portfolio
          </p>
          {reachedCount > 0 && (
            <Badge variant="default" className="text-[10px] h-5 gap-1">
              <Trophy className="size-3" />
              {reachedCount} alcanzados
            </Badge>
          )}
        </div>
        <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => setAddOpen(true)}>
          <Plus className="size-3" />
          Nuevo hito
        </Button>
      </div>

      {nextMilestone && currentPortfolioUsd && (
        <div className="rounded-xl border border-border bg-card shadow-sm p-4 mb-4">
          <p className="text-xs text-muted-foreground mb-2">Próximo hito</p>
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-foreground">{nextMilestone.label}</span>
            <span className="text-sm font-mono text-muted-foreground">
              {formatUSD(currentPortfolioUsd)} / {formatUSD(nextMilestone.targetValueUsd)}
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-chart-1 rounded-full transition-all duration-700"
              style={{
                width: `${Math.min((currentPortfolioUsd / nextMilestone.targetValueUsd) * 100, 100)}%`,
              }}
            />
          </div>
          <p className="text-xs text-muted-foreground mt-1.5">
            {((currentPortfolioUsd / nextMilestone.targetValueUsd) * 100).toFixed(1)}% completado
          </p>
        </div>
      )}

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        {milestones.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
            Sin hitos configurados
          </div>
        ) : (
          <div className="divide-y divide-border">
            {milestones.map((m) => (
              <div key={m.id || m.label} className="flex items-center justify-between px-5 py-3.5">
                <div className="flex items-center gap-3">
                  {m.reached ? (
                    <CheckCircle2 className="size-4 text-emerald-500 shrink-0" />
                  ) : (
                    <div className="size-4 rounded-full border-2 border-muted-foreground/30 shrink-0" />
                  )}
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={`text-sm font-medium ${m.reached ? "text-muted-foreground line-through" : "text-foreground"}`}
                    >
                      {m.label}
                    </span>
                    {m.reachedAt && (
                      <span className="text-[10px] text-muted-foreground">
                        Alcanzado el{" "}
                        {new Intl.DateTimeFormat("es-AR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        }).format(new Date(m.reachedAt))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm font-mono tabular-nums text-muted-foreground">
                    {formatUSD(m.targetValueUsd)}
                  </span>
                  {m.id && (
                    <Button
                      size="sm"
                      variant="ghost"
                      className="size-7 p-0"
                      disabled={isPending}
                      onClick={() => handleDelete(m.id)}
                    >
                      <Trash2 className="size-3.5 text-muted-foreground" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-sm font-medium">Nuevo hito</DialogTitle>
          </DialogHeader>
          <Separator className="opacity-30" />
          <form onSubmit={handleAdd} className="flex flex-col gap-4 pt-1">
            <Field>
              <FieldLabel className="text-xs font-medium">Nombre del hito</FieldLabel>
              <Input
                placeholder="USD 500.000"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                required
                className="text-sm"
              />
            </Field>
            <Field>
              <FieldLabel className="text-xs font-medium">Valor objetivo (USD)</FieldLabel>
              <Input
                type="number"
                placeholder="500000"
                min="1"
                step="1000"
                value={targetUsd}
                onChange={(e) => setTargetUsd(e.target.value)}
                required
                className="text-sm font-mono"
              />
            </Field>
            <div className="flex gap-2 justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setAddOpen(false)} className="text-xs">
                Cancelar
              </Button>
              <Button type="submit" size="sm" disabled={isPending} className="gap-2">
                {isPending && <Spinner className="size-3" />}
                Crear
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
