# ADR-0020: Alertas por mail con un cron diario y Gmail SMTP

- **Estado:** Aceptado
- **Fecha:** 2026-10-09
- **Relacionados:** ADR-0002 (suma un tercer motivo para un route handler: el cron), ADR-0006, ADR-0008, ADR-0016, ADR-0018, ADR-0019

## Contexto

La estrategia del autor es de largo plazo y oportunista: comprar cuando una buena empresa cae. Para eso hoy tiene que entrar a la app y mirar. Además, las métricas sin aportes (ADR-0019) y el reporte para impuestos dependen de que el snapshot y los movimientos de cada mes estén importados, y nada le recuerda hacerlo.

Hasta ahora la app no corre nada sola: todo dato externo se refresca con un botón (ADR-0006) y no hay ningún canal para avisarle algo al usuario fuera de la app.

## Decisión

Un **cron diario** revisa a cada usuario con alertas activas y le manda **un único mail por Gmail SMTP** solo si hay algo para avisar.

- **Disparo:** Vercel Cron (`vercel.json`) llama a `GET /api/cron/alerts` todos los días a las 12:00 UTC (9:00 en Argentina). El route valida `Authorization: Bearer <CRON_SECRET>` con comparación de tiempo constante; el proxy lo deja pasar sin sesión. El plan Hobby admite un cron por día como máximo, y alcanza.
- **Caídas:** para cada posición del último snapshot con subyacente en el catálogo, se piden a Yahoo los cierres del último año (`getHistorical`) y se calculan la distancia al máximo de 52 semanas (`priceSignals`) y la variación contra 5 ruedas antes (`sessionChangePct`). Hay alerta si alguna supera el umbral del usuario (15 % y 8 % por defecto). El mail suma hasta 3 titulares recientes de la empresa (`getNews` + `selectNews`), para distinguir una noticia propia de una caída del mercado.
- **No repetir:** `AlertLog` guarda cada aviso. Una caída vuelve a avisarse a los 7 días o si se profundizó 5 puntos desde el último aviso.
- **Recordatorio:** desde el día del mes que elija el usuario (5 por defecto, en hora de Argentina), si falta un snapshot con fecha del mes anterior o movimientos hasta su última semana. Se repite cada 3 días hasta que se carguen.
- **Envío:** `nodemailer` contra `smtp.gmail.com:465` con `GMAIL_USER` y una contraseña de aplicación (`GMAIL_APP_PASSWORD`), con timeouts de 15 s. Los mails van al email de la cuenta del usuario; no hay destinatarios configurables.
- **Configuración por usuario:** `AlertSettings` (desactivadas por defecto) se edita en `/alertas`, que también permite mandar un mail de prueba y "Revisar ahora" (la misma revisión para el usuario de la sesión, sin la regla de no repetir).
- **Precios:** los cierres que pide el cron **no se guardan** en las caches: son un dato de entrada de la alerta, igual que en el reporte de oportunidades (ADR-0018). ADR-0006 sigue valiendo para las pantallas.
- **Lógica:** pura y testeada en `lib/alerts.ts`; `lib/alerts-runner.ts` junta datos, llama a Yahoo, manda y registra.

## Alternativas

- **Resend desde el Marketplace de Vercel:** es la opción recomendada para mails transaccionales, pero exige un dominio de envío verificado con DNS. El autor prefirió no sumar un servicio ni usar uno de sus dominios. Si Gmail falla o se quiere mandar a otros destinatarios, migrar a Resend cambia solo `lib/mailer.ts`.
- **Panel de alertas dentro de la app:** sin servicio externo, pero hay que entrar para verlas, que es justo lo que se quería evitar.
- **Cron más frecuente (cada hora):** no lo permite el plan Hobby y, para una estrategia de largo plazo, una revisión diaria alcanza.
- **Guardar los precios del cron en `historical_price_cache`:** mezclaría el refresco automático con el manual de las pantallas; no hace falta para las alertas.

## Consecuencias

**Positivas**

- El usuario se entera de una caída o de una carga pendiente sin abrir la app.
- Un único mail por día con todo junto, sin repetir lo mismo todos los días.

**Negativas / costos**

- Depende de una cuenta de Gmail y su contraseña de aplicación; Gmail limita el envío diario y puede marcar los mails como spam.
- Unas 16 llamadas a Yahoo por usuario por día (la historia de un subyacente se comparte entre usuarios en la misma corrida).
- Las acciones sin subyacente en el catálogo (acciones locales, FCI) no se revisan.

**Reglas para el código**

- La autorización del cron es `CRON_SECRET`; cualquier route nuevo bajo `/api/cron/` tiene que validarlo, porque el proxy no le pide sesión.
- La respuesta del cron devuelve solo conteos: nada de emails ni datos de usuarios.
- Toda lectura del runner filtra por `userId` (ADR-0008); el catálogo de assets es global.
- Umbrales y reglas de repetición nuevas van en `lib/alerts.ts` con tests.

## Referencias

- `lib/alerts.ts`, `lib/alerts.test.ts`, `lib/alerts-runner.ts`, `lib/mailer.ts`, `app/api/cron/alerts/route.ts`, `app/actions/alerts.ts`, `app/(app)/alertas/page.tsx`, `vercel.json`, `proxy.ts`.
- Modelos `AlertSettings` y `AlertLog` (migración `20261009120000_add_alerts`).

## Seguimiento

- **Datos de mercado en el mismo cron (ADR-0021).** Antes de las alertas, la corrida diaria actualiza CCL, precios, históricos, benchmarks, IPC y CER. Los cierres del último año que usan las alertas siguen sin guardarse.
