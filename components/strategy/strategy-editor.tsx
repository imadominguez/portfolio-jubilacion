"use client";

import { useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { saveNewVersion, restoreVersion } from "@/app/actions/strategy";
import type { InvestmentStrategy } from "@/app/generated/prisma/client";
import { CheckCircle2, Clock, RotateCcw, Save, AlertCircle, BookOpen } from "lucide-react";

interface StrategyEditorProps {
  active: InvestmentStrategy | null;
  history: InvestmentStrategy[];
}

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(date));
}

export function StrategyEditor({ active, history }: StrategyEditorProps) {
  const [content, setContent] = useState(active?.content ?? "");
  const [title, setTitle] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isDirty = content.trim() !== (active?.content ?? "").trim();

  const handleSave = () => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await saveNewVersion(content, title || `Versión ${(active?.version ?? 0) + 1}`);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSuccessMsg(`Versión ${result.strategy.version} guardada como activa.`);
        setTitle("");
      }
    });
  };

  const handleRestore = (id: string, version: number) => {
    setError(null);
    setSuccessMsg(null);
    startTransition(async () => {
      const result = await restoreVersion(id);
      if (!result.ok) {
        setError(result.error);
      } else {
        setSuccessMsg(`Versión ${version} restaurada como activa. Recargá para ver los cambios.`);
      }
    });
  };

  const pastVersions = history.filter((v) => v.id !== active?.id);

  return (
    <div className="flex flex-col gap-6">
      {/* Editor de versión activa */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="text-base flex items-center gap-2">
              <BookOpen className="w-4 h-4 text-primary" />
              Estrategia activa
            </CardTitle>
            {active && (
              <Badge
                variant="outline"
                className="text-[11px] bg-green-50 text-green-700 border-green-200 dark:bg-green-950/30 dark:text-green-400 dark:border-green-900/50"
              >
                <CheckCircle2 className="w-3 h-3 mr-1" />
                v{active.version} — Activa desde {formatDate(active.createdAt)}
              </Badge>
            )}
          </div>
          {active && (
            <p className="text-xs text-muted-foreground">
              {active.title}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Contenido del system prompt</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={24}
              className="font-mono text-xs resize-y leading-relaxed"
              placeholder="Pegá aquí el system prompt de la estrategia..."
            />
          </div>

          <Separator />

          <div className="flex flex-col sm:flex-row items-start sm:items-end gap-3">
            <div className="flex-1 space-y-1.5 w-full">
              <Label className="text-xs text-muted-foreground">
                Título para la nueva versión <span className="opacity-60">(opcional)</span>
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={`Versión ${(active?.version ?? 0) + 1} — breve descripción del cambio`}
                className="text-sm"
              />
            </div>
            <Button
              onClick={handleSave}
              disabled={!isDirty || isPending}
              className="shrink-0 gap-2"
            >
              <Save className="w-4 h-4" />
              {isPending ? "Guardando…" : "Guardar nueva versión"}
            </Button>
          </div>

          {!isDirty && active && (
            <p className="text-xs text-muted-foreground">
              Modificá el contenido para poder guardar una nueva versión.
            </p>
          )}

          {error && (
            <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900/50 rounded-lg px-4 py-3">
              <AlertCircle className="w-4 h-4 shrink-0" />
              {error}
            </div>
          )}
          {successMsg && (
            <div className="flex items-center gap-2 text-sm text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-950/40 border border-green-200 dark:border-green-900/50 rounded-lg px-4 py-3">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              {successMsg}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Historial de versiones anteriores */}
      {pastVersions.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              Historial de versiones
            </CardTitle>
            <p className="text-xs text-muted-foreground">
              {pastVersions.length} versión{pastVersions.length !== 1 ? "es" : ""} anterior{pastVersions.length !== 1 ? "es" : ""}. Restaurar una la convierte en activa de forma atómica.
            </p>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col divide-y divide-border">
              {pastVersions.map((v) => (
                <div key={v.id} className="py-3.5 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-medium text-foreground truncate">{v.title}</span>
                      <Badge variant="secondary" className="text-[10px] font-mono shrink-0">
                        v{v.version}
                      </Badge>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      Guardada el {formatDate(v.createdAt)}
                    </span>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="shrink-0 gap-1.5 text-xs"
                    disabled={isPending}
                    onClick={() => handleRestore(v.id, v.version)}
                  >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {history.length === 0 && !active && (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center">
          <div className="size-12 rounded-full bg-muted flex items-center justify-center">
            <BookOpen className="size-5 text-muted-foreground" />
          </div>
          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">Sin estrategia configurada</p>
            <p className="text-xs text-muted-foreground max-w-xs">
              Pegá el contenido del system prompt en el editor y guardá la primera versión.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
