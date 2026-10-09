"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { CalendarRange, Mail, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import {
  runAlertsNow,
  saveAlertSettings,
  sendMonthlySummary,
  sendTestAlertEmail,
  type AlertActionResult,
  type AlertSettingsData,
} from "@/app/actions/alerts";

// Copia la configuración a su estado: la página le pasa un `key` derivado de
// los datos para que <Activity> no conserve valores viejos.
export function AlertSettingsForm({
  initial,
  mailerReady,
  isAdmin,
}: {
  initial: AlertSettingsData;
  mailerReady: boolean;
  isAdmin: boolean;
}) {
  const [enabled, setEnabled] = useState(initial.enabled);
  const [dropFromHigh, setDropFromHigh] = useState(String(initial.dropFromHighPct));
  const [weeklyDrop, setWeeklyDrop] = useState(String(initial.weeklyDropPct));
  const [reminderDay, setReminderDay] = useState(String(initial.reminderDay));
  const [monthlySummary, setMonthlySummary] = useState(initial.monthlySummary);
  const [monthlyReport, setMonthlyReport] = useState(initial.monthlyReport);
  const [pending, setPending] = useState<"save" | "test" | "run" | "summary" | null>(null);
  const [, startTransition] = useTransition();

  function run(kind: "save" | "test" | "run" | "summary", action: () => Promise<AlertActionResult>) {
    setPending(kind);
    startTransition(async () => {
      const result = await action();
      if (result.success) toast.success(result.message);
      else toast.error(result.error);
      setPending(null);
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    run("save", () =>
      saveAlertSettings({
        enabled,
        dropFromHighPct: Number(dropFromHigh),
        weeklyDropPct: Number(weeklyDrop),
        reminderDay: Number(reminderDay),
        monthlySummary,
        monthlyReport,
      })
    );
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-6">
      <FieldGroup>
        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="alerts-enabled">Mandarme alertas por mail</FieldLabel>
            <FieldDescription>Se revisan todos los días a las 9 (hora de Argentina).</FieldDescription>
          </FieldContent>
          <Switch id="alerts-enabled" checked={enabled} onCheckedChange={setEnabled} />
        </Field>

        <Field orientation="horizontal">
          <FieldContent>
            <FieldLabel htmlFor="monthly-summary">Resumen mensual</FieldLabel>
            <FieldDescription>Rendimiento, flujo de caja, gastos y Plan DCA del mes anterior.</FieldDescription>
          </FieldContent>
          <Switch id="monthly-summary" checked={monthlySummary} onCheckedChange={setMonthlySummary} />
        </Field>

        {isAdmin && (
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="monthly-report">Reporte de oportunidades automático</FieldLabel>
              <FieldDescription>
                Lo genera el 1° de cada mes si no hay uno del mes, así el Plan DCA usa señales nuevas. Cuesta unos
                US$ 0,07 por reporte.
              </FieldDescription>
            </FieldContent>
            <Switch id="monthly-report" checked={monthlyReport} onCheckedChange={setMonthlyReport} />
          </Field>
        )}

        <div className="grid gap-4 sm:grid-cols-3">
          <Field>
            <FieldLabel htmlFor="drop-from-high">Caída desde el máximo (%)</FieldLabel>
            <Input
              id="drop-from-high"
              type="number"
              inputMode="decimal"
              min={1}
              max={90}
              step={0.5}
              value={dropFromHigh}
              onChange={(e) => setDropFromHigh(e.target.value)}
            />
            <FieldDescription>Contra el máximo de 52 semanas de la acción en USD.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="weekly-drop">Caída en la semana (%)</FieldLabel>
            <Input
              id="weekly-drop"
              type="number"
              inputMode="decimal"
              min={1}
              max={50}
              step={0.5}
              value={weeklyDrop}
              onChange={(e) => setWeeklyDrop(e.target.value)}
            />
            <FieldDescription>Contra el cierre de 5 ruedas antes.</FieldDescription>
          </Field>
          <Field>
            <FieldLabel htmlFor="reminder-day">Recordatorio desde el día</FieldLabel>
            <Input
              id="reminder-day"
              type="number"
              inputMode="numeric"
              min={1}
              max={28}
              step={1}
              value={reminderDay}
              onChange={(e) => setReminderDay(e.target.value)}
            />
            <FieldDescription>Del mes, si falta cargar el mes anterior.</FieldDescription>
          </Field>
        </div>
      </FieldGroup>

      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={pending !== null}>
          {pending === "save" && <Spinner />}
          Guardar
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null || !mailerReady}
          onClick={() => run("test", sendTestAlertEmail)}
        >
          {pending === "test" ? <Spinner /> : <Mail className="size-3.5" />}
          Mandar mail de prueba
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null || !mailerReady}
          onClick={() => run("run", runAlertsNow)}
        >
          {pending === "run" ? <Spinner /> : <Search className="size-3.5" />}
          Revisar ahora
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={pending !== null || !mailerReady}
          onClick={() => run("summary", sendMonthlySummary)}
        >
          {pending === "summary" ? <Spinner /> : <CalendarRange className="size-3.5" />}
          Mandar el resumen ahora
        </Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-3">
        &quot;Revisar ahora&quot; usa la configuración guardada y manda todo lo que hoy cumple los umbrales,
        aunque ya te haya avisado.
      </p>
    </form>
  );
}
