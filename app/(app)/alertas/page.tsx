import type { Metadata } from "next";
import { Suspense } from "react";
import { AlertTriangle, Bell, CalendarClock, TrendingDown } from "lucide-react";
import { SiteHeader } from "@/components/layout/site-header";
import { AlertSettingsForm } from "@/components/alerts/alert-settings-form";
import { AlertsSkeleton } from "@/components/alerts/alerts-skeleton";
import { getAlertsPageData } from "@/app/actions/alerts";
import { requireAuth } from "@/lib/auth-session";
import { isMailerConfigured } from "@/lib/mailer";
import { monthLabel } from "@/lib/local-date";

export const metadata: Metadata = { title: "Alertas" };

// El header y la explicación entran al static shell; la configuración del
// usuario se lee en request time detrás del skeleton.
export default function AlertsPage() {
  return (
    <div className="flex flex-col min-h-svh">
      <SiteHeader title="Alertas" description="Avisos por mail" />

      <main className="flex-1 px-6 py-10 flex flex-col gap-8 max-w-4xl w-full mx-auto">
        <div className="animate-fade-up flex flex-col gap-3">
          <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
            La app revisa tu portfolio todos los días y te manda un mail solo si pasa algo:
          </p>
          <ul className="flex flex-col gap-2 text-sm text-muted-foreground max-w-2xl">
            <li className="flex gap-2">
              <TrendingDown className="size-4 shrink-0 mt-0.5 text-foreground" />
              <span>
                <span className="text-foreground font-medium">Caídas:</span> una acción de tu último snapshot
                cae más de lo que configures desde su máximo del año o en la semana. El mail trae los titulares
                recientes de la empresa, para ver si hay una noticia detrás o es el mercado. No repite la misma
                caída salvo que se profundice 5 puntos más; si sigue abajo, te lo recuerda una vez por mes.
              </span>
            </li>
            <li className="flex gap-2">
              <CalendarClock className="size-4 shrink-0 mt-0.5 text-foreground" />
              <span>
                <span className="text-foreground font-medium">Carga del mes:</span> desde el día que elijas, si
                falta el snapshot o los movimientos del mes anterior. Se repite cada 3 días hasta que los cargues.
              </span>
            </li>
          </ul>
        </div>

        <Suspense fallback={<AlertsSkeleton />}>
          <AlertsContent />
        </Suspense>
      </main>
    </div>
  );
}

const dateTime = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

async function AlertsContent() {
  const [session, data] = await Promise.all([requireAuth(), getAlertsPageData()]);
  const mailerReady = isMailerConfigured();
  const { settings, logs } = data;

  return (
    <div className="flex flex-col gap-8">
      {!mailerReady && (
        <div className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 px-4 py-3 text-xs leading-relaxed text-muted-foreground">
          <AlertTriangle className="size-4 shrink-0 text-warning" />
          <p>
            El envío de mails no está configurado: faltan las variables <code>GMAIL_USER</code> y{" "}
            <code>GMAIL_APP_PASSWORD</code> en el servidor. Podés guardar la configuración igual.
          </p>
        </div>
      )}

      <section className="animate-fade-up rounded-xl border border-border bg-card shadow-sm p-5 flex flex-col gap-4">
        <p className="text-xs text-muted-foreground">
          Los mails van a <span className="text-foreground font-medium">{session.user.email}</span>.
        </p>
        <AlertSettingsForm
          key={`${settings.enabled}-${settings.dropFromHighPct}-${settings.weeklyDropPct}-${settings.reminderDay}`}
          initial={settings}
          mailerReady={mailerReady}
        />
      </section>

      <section className="animate-fade-up flex flex-col gap-3">
        <p className="text-[10px] font-medium tracking-[0.15em] text-muted-foreground uppercase">
          Últimas alertas enviadas
        </p>
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          {logs.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Bell className="size-6 text-muted-foreground/50" />
              <p className="text-xs text-muted-foreground">Todavía no se mandó ninguna alerta.</p>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {logs.map((l) => (
                <li key={l.id} className="px-5 py-3 flex items-center justify-between gap-4 text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    {l.kind === "PRICE_DROP" ? (
                      <TrendingDown className="size-4 shrink-0 text-destructive" />
                    ) : (
                      <CalendarClock className="size-4 shrink-0 text-warning" />
                    )}
                    <span className="truncate">
                      {l.kind === "PRICE_DROP" ? (
                        <>
                          <span className="font-mono font-bold">{l.key}</span>
                          {l.value !== null && (
                            <span className="text-muted-foreground">
                              {" "}
                              {l.value.toFixed(1)} % desde el máximo
                            </span>
                          )}
                        </>
                      ) : (
                        <>Recordatorio de carga de {monthLabel(l.key)}</>
                      )}
                    </span>
                  </span>
                  <span className="text-xs font-mono text-muted-foreground shrink-0">
                    {dateTime.format(l.sentAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
