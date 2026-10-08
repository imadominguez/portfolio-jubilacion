"use server";

import { cacheLife, cacheTag } from "next/cache";
import { db } from "@/lib/db";
import { requireAuth, requireUserId } from "@/lib/auth-session";
import { userTags } from "@/lib/cache-tags";
import { revalidateAlerts } from "@/lib/revalidate";
import { DEFAULT_REMINDER_DAY, DEFAULT_THRESHOLDS } from "@/lib/alerts";
import { runAlertsForUser } from "@/lib/alerts-runner";
import { sendMail } from "@/lib/mailer";

export type AlertSettingsData = {
  enabled: boolean;
  dropFromHighPct: number;
  weeklyDropPct: number;
  reminderDay: number;
};

export type AlertLogRow = {
  id: string;
  kind: "PRICE_DROP" | "REMINDER";
  key: string;
  value: number | null;
  sentAt: Date;
};

export type AlertsPageData = { settings: AlertSettingsData; logs: AlertLogRow[] };

export type AlertActionResult = { success: true; message: string } | { success: false; error: string };

const RECENT_LOGS = 20;

export async function getAlertsPageData(): Promise<AlertsPageData> {
  return cachedAlertsPageData(await requireUserId());
}

// No se exporta: recibe el userId ya resuelto de la sesión (ADR-0017).
async function cachedAlertsPageData(userId: string): Promise<AlertsPageData> {
  "use cache";
  cacheLife("hours");
  cacheTag(userTags.alerts(userId));

  const [settings, logs] = await Promise.all([
    db.alertSettings.findUnique({ where: { userId } }),
    db.alertLog.findMany({ where: { userId }, orderBy: { sentAt: "desc" }, take: RECENT_LOGS }),
  ]);

  return {
    settings: settings
      ? {
          enabled: settings.enabled,
          dropFromHighPct: Number(settings.dropFromHighPct),
          weeklyDropPct: Number(settings.weeklyDropPct),
          reminderDay: settings.reminderDay,
        }
      : { enabled: false, ...DEFAULT_THRESHOLDS, reminderDay: DEFAULT_REMINDER_DAY },
    logs: logs.map((l) => ({
      id: l.id,
      kind: l.kind,
      key: l.key,
      value: l.value !== null ? Number(l.value) : null,
      sentAt: l.sentAt,
    })),
  };
}

export async function saveAlertSettings(data: AlertSettingsData): Promise<AlertActionResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;

    const inRange = (n: number, min: number, max: number) => Number.isFinite(n) && n >= min && n <= max;
    if (!inRange(data.dropFromHighPct, 1, 90)) {
      return { success: false, error: "La caída desde el máximo tiene que estar entre 1 % y 90 %." };
    }
    if (!inRange(data.weeklyDropPct, 1, 50)) {
      return { success: false, error: "La caída semanal tiene que estar entre 1 % y 50 %." };
    }
    if (!Number.isInteger(data.reminderDay) || !inRange(data.reminderDay, 1, 28)) {
      return { success: false, error: "El día del recordatorio tiene que estar entre 1 y 28." };
    }

    const values = {
      enabled: data.enabled,
      dropFromHighPct: data.dropFromHighPct,
      weeklyDropPct: data.weeklyDropPct,
      reminderDay: data.reminderDay,
    };
    await db.alertSettings.upsert({ where: { userId }, create: { userId, ...values }, update: values });

    revalidateAlerts(userId);
    return { success: true, message: data.enabled ? "Alertas activadas." : "Cambios guardados." };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}

// Para comprobar que el mail llega (credenciales de Gmail, spam).
export async function sendTestAlertEmail(): Promise<AlertActionResult> {
  try {
    const session = await requireAuth();
    await sendMail({
      to: session.user.email,
      subject: "Portfolio: mail de prueba",
      text: "Si leés esto, las alertas por mail de Portfolio Jubilación te van a llegar.",
      html: "<p>Si leés esto, las alertas por mail de Portfolio Jubilación te van a llegar.</p>",
    });
    return { success: true, message: `Mail de prueba enviado a ${session.user.email}.` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudo mandar el mail." };
  }
}

// Corre la revisión ahora para el usuario de la sesión, sin la regla de no
// repetir: manda todo lo que hoy cumple los umbrales.
export async function runAlertsNow(): Promise<AlertActionResult> {
  try {
    const session = await requireAuth();
    const userId = session.user.id;
    const result = await runAlertsForUser(userId, { force: true });
    revalidateAlerts(userId);

    const unchecked =
      result.unchecked.length > 0 ? ` Sin precios para ${result.unchecked.join(", ")}.` : "";
    if (!result.sent) {
      return { success: true, message: `Nada para avisar hoy: ninguna caída supera los umbrales y los datos del mes están cargados.${unchecked}` };
    }
    const parts: string[] = [];
    if (result.drops.length > 0) parts.push(`caídas en ${result.drops.join(", ")}`);
    if (result.reminder) parts.push("recordatorio de carga");
    return { success: true, message: `Mail enviado a ${session.user.email}: ${parts.join(" y ")}.${unchecked}` };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "No se pudieron revisar las alertas." };
  }
}
