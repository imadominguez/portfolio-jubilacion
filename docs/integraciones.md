# Integraciones externas

La app consume cinco fuentes externas. Todas se cachean en base de datos para evitar llamadas repetidas y dependencias de red en el render.

---

## 1. Cocos Capital (CSV)

Fuente primaria del estado del portafolio. No hay API: se descargan archivos CSV manualmente y se importan.

### A) Snapshot de Portfolio

- Archivo: `portfolio_report_AAAAMMDD.csv`.
- Delimitador autodetectado (`;` o `,`).
- Columnas: `instrumento; cantidad; precio; moneda; total`.
- Usado por `parseSnapshotPreview` / `importSnapshot` (`app/actions/snapshots.ts`).
- El ticker se extrae del paréntesis del nombre (`(NVDA)`).

### B) Movimientos (Actividad)

- Archivo: `movements_report_YYYY-MM-DD_YYYY-MM-DD.csv`.
- Separador `;`; números con coma decimal, miles con punto; fechas `DD-MM-YYYY`.
- Columnas: `nroticket, fechaejecucion, tipooperacion, instrumento, moneda, cantidad, precio, montobruto, comision, ddmm, iva, otros, total`.
- Parseado por `parseMovementCsv` (`lib/cocos-movements.ts`, puro: corre en el cliente para la previsualización) y persistido por `importMovements` (`app/actions/import-movements.ts`) de forma idempotente por `nroTicket`.
- Análisis detallado del formato: [`movimientos/analisis-csv-movimientos.md`](./movimientos/analisis-csv-movimientos.md).
- Qué alimenta cada categoría del libro:
  - `TRADE_BUY` / `TRADE_SELL` → `Transaction` (PPM, P&L realizado, ventas del reporte para impuestos). Las ventas vienen con cantidad negativa y, en bonos y ONs, el precio es cada 100 nominales (el reporte para impuestos usa `montobruto`).
  - Compras y ventas, FCI, dividendos y `OTHER` con instrumento → flujos del rendimiento sin aportes (ADR-0019).
  - `DIVIDEND` / `DIVIDEND_IN_KIND` → dividendos del reporte para impuestos (los de CEDEARs llegan en dólares, sin decir de qué acción).
  - `PAYMENT` ("Orden De Pago") → gastos del mes en `/transactions`. No traen destino: la categoría la pone el usuario (`ExpenseTag`).
  - Fecha del último movimiento → aviso de cobertura en `/performance` y recordatorio mensual de las alertas.

Guía visual: `components/guide/cocos-guide.tsx` (ruta `/guia`), con esquemas de las pantallas de Cocos dibujados en `components/guide/cocos-mockup.tsx` (sin capturas: siguen el tema y no exponen datos de una cuenta).

---

## 2. dolarapi.com — CCL actual

- Endpoint: `GET https://dolarapi.com/v1/dolares/contadoconliqui` (`cache: "no-store"`).
- Campo usado: `venta ?? compra`.
- Se guarda por fecha (medianoche local) en `ExchangeRate` con `source: "dolarapi.com"`.
- Implementado en `fetchAndSaveCCL` (`app/actions/exchange-rate.ts`).
- Disparado desde `CclUpdateButton` (`/datos`, `/ccl`, `/assets`) y como parte del wizard de ganancia real.

---

## 3. argentinadatos.com — CCL histórico

- Endpoint: `GET https://api.argentinadatos.com/v1/cotizaciones/dolares/contadoconliqui`.
- Se filtra por rango `[from, to]`, se deduplica por día (`YYYY-MM-DD`) y se hace upsert con `source: "argentinadatos.com"`.
- Implementado en `fetchHistoricalCCL` (`app/actions/exchange-rate.ts`).
- Se usa para el backfill histórico del CCL (wizard de `/real-gains`, que arranca desde `firstBuyDate − 7 días`).

### Índices macro — IPC y CER/UVA

Usados en `/performance` para comparar el portfolio contra la inflación.

| Dato | Endpoint | Forma | Persistencia |
|---|---|---|---|
| IPC mensual | `GET /v1/finanzas/indices/inflacion` | `[{ fecha (fin de mes), valor: <% mensual> }]` | `BenchmarkPoint` con `benchmarkId: "inflacion"` como **índice acumulado base 100** |
| CER (proxy UVA) | `GET /v1/finanzas/indices/uva` | `[{ fecha, valor }]` (índice diario) | `BenchmarkPoint` con `benchmarkId: "cer"` (valor directo) |

- Implementado en `app/actions/indices.ts` (`fetchAndSaveInflation`, `fetchAndSaveCer`, y `fetchAndSaveAllIndices` que corre ambos desde el primer snapshot del usuario).
- El IPC se compone con `buildCumulativeIndex` (`lib/inflation.ts`) porque la API entrega **tasas**, no un índice.
- No existe endpoint `/cer` en argentinadatos; **UVA** es el índice diario basado en CER.
- La lectura (`getIndexPoints`) reutiliza `getBenchmarkPoints`, que normaliza a base 100.

---

## 4. Yahoo Finance — precios

Cliente propio en `lib/yahoo-finance-client.ts` (no usa `yahoo-finance2`). Implementa el flujo **cookie + crumb** que Yahoo exige desde 2023, con `fetch` nativo para que funcione en cualquier entorno server ([ADR-0007](./adr/0007-cliente-propio-de-yahoo-finance.md)).

### Autenticación

- `getAuth()` (interna):
  1. `GET https://fc.yahoo.com` con User-Agent de Chrome para obtener cookies de sesión.
  2. `GET https://query1.finance.yahoo.com/v1/test/getcrumb` (fallback a `query2`) para el crumb.
  3. Cachea cookie + crumb a nivel de módulo con TTL de **23 horas**.
- Si una consulta (`quote` o `chart`) responde **401 o 403**, Yahoo invalidó la sesión antes de tiempo: se descarta la auth cacheada, se pide una nueva y se reintenta **una vez** (`authedGet`).
- Si falla la cookie → lanza `"No se pudo obtener la cookie de sesión de Yahoo Finance."`; si falla el crumb → `"No se pudo obtener el crumb de Yahoo Finance (<status>)."`.

### Endpoints

| Función | Endpoint | Uso |
|---|---|---|
| `getQuotes(symbols)` | `/v7/finance/quote?symbols=...&crumb=...` | Precio actual; `regularMarketPrice ?? ask ?? bid`. |
| `getHistorical(symbol, from, to)` | `/v8/finance/chart/:symbol?interval=1d&period1=...&period2=...` | Cierres diarios. |
| `getNews(symbol, count)` | `/v1/finance/search?q=...&newsCount=...` (sin cookie ni crumb) | Titulares recientes con fecha, medio y tickers relacionados. El filtro de relevancia es `selectNews` (`lib/opportunity-signals.ts`). |

`getHistorical` filtra velas sin `close` o `≤ 0` y normaliza la fecha a medianoche UTC (`setUTCHours(0,0,0,0)`) para coincidir con `@db.Date`.

### Persistencia y consumidores

| Action | Función Yahoo | Tabla destino |
|---|---|---|
| `market-prices.ts` | `getQuotes` | `MarketPriceCache` (upsert por ticker subyacente, USD) |
| `historical-prices.ts` | `getHistorical` | `HistoricalPriceCache` (upsert `ticker`+`date`) |
| `benchmarks.ts` | `getHistorical` | `BenchmarkPoint` (upsert `benchmarkId`+`date`) |
| `api/analyze-portfolio` | `getHistorical`, `getNews` | No persiste: son la entrada del reporte de oportunidades (ADR-0018). |

- El histórico de subyacentes se pide desde la primera compra (o −365 días si no hay) hasta hoy.
- Los tickers subyacentes provienen del campo `Asset.underlyingTicker`.

### Timeouts

Todas las llamadas a Yahoo, dolarapi y argentinadatos usan `fetchWithTimeout` (`lib/http.ts`, 15 s por defecto). Si una API no responde, la action devuelve un error que nombra el servicio (p. ej. "Yahoo Finance no respondió en 15 s. Probá de nuevo en unos minutos.") en lugar de quedar colgada hasta el `maxDuration` de la función.

---

## 5. Anthropic (Claude) — reporte de oportunidades

Decisión y motivos: [ADR-0018](./adr/0018-reporte-de-oportunidades-con-datos-preparados-por-la-app.md).

- **SDK oficial** `@anthropic-ai/sdk` (`client.beta.messages.parse`), sin streaming: la respuesta es corta.
- Variables de entorno: `ANTHROPIC_API_KEY` (obligatoria), `ANTHROPIC_MODEL` (default `claude-sonnet-5-5`), `ANTHROPIC_EFFORT` (default `low`: `low|medium|high|xhigh|max`), `ANTHROPIC_TIMEOUT_MS` (default y máximo `290000`, por debajo de `maxDuration`).
- **Entrada:** la app prepara los datos (precios de Yahoo, titulares de noticias de Yahoo, precio promedio de compra) y le pasa a Claude un texto compacto por acción (medido: ~6.200 tokens de entrada para 14 acciones). Claude **no** busca en la web.
- **Salida:** structured output con `OpportunityAnalysisSchema` (`lib/opportunity-report.ts`): señal `compra` / `mantener` / `venta` por acción, con confianza y una lectura corta de precio, noticias, motivo y riesgos. La respuesta siempre valida contra el esquema.
- `system` = contenido de la `InvestmentStrategy` activa (editable y versionada en `/strategy`): define solo el **criterio**; el formato lo fija el esquema.
- Thinking adaptativo con el `effort` configurado, y `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`): si el modelo rechaza por sus clasificadores de seguridad, la API reintenta en otro modelo. Cada parámetro va solo a los modelos que lo aceptan (`modelRequestOptions`): `effort` y thinking también a `claude-sonnet-5`; `fallbacks`, solo a Sonnet 5.5, Opus 5.5, Opus 5 y Fable 5.1.
- **Costo:** `estimateCostUsd(response.model, usage)` usa los precios del modelo que respondió (`MODEL_PRICING`; `null` si no está). Se guarda en el reporte (`uso`) y se muestra al pie. Primera medición real: US$ 0,0656 (6.222 tokens de entrada, 5.314 de salida, `claude-sonnet-5` sin `effort`).
- `maxDuration = 300` s en el route; el timeout propio se acota a 290 s para devolver un `504` claro antes de que la plataforma corte.
- Salida guardada en `PortfolioReport` (`version: 2`) y mostrada en `/portfolio`.

Detalle completo en [api-y-exportacion.md](./api-y-exportacion.md#post-apianalyze-portfolio--reporte-de-oportunidades-con-ia).

---

## 6. Gmail (SMTP) — alertas por mail

Decisión y motivos: [ADR-0020](./adr/0020-alertas-por-mail-con-cron-y-gmail-smtp.md).

- `nodemailer` contra `smtp.gmail.com:465` (TLS) en `lib/mailer.ts`, con timeouts de conexión, saludo y socket de 15 s.
- Variables: `GMAIL_USER` (la cuenta que envía) y `GMAIL_APP_PASSWORD` (contraseña de aplicación de Google, requiere verificación en dos pasos). Sin ellas, `/alertas` avisa y el envío falla con un error claro.
- Remitente `"Portfolio Jubilación" <GMAIL_USER>`; destinatario, el email de la cuenta del usuario.
- El cron diario también pide a Yahoo los cierres del último año y los titulares de cada acción del último snapshot; no los guarda en las caches.

---

## Resumen

| Fuente | Dato | Actualización | Cache |
|---|---|---|---|
| Cocos Capital (CSV) | Posiciones y movimientos | Manual (importación) | DB (`portfolio_snapshots`, `movements`, `transactions`) |
| dolarapi.com | CCL actual | Diaria (cron) y manual (botón) | `exchange_rates` |
| argentinadatos.com | CCL histórico | Manual (wizard/backfill) | `exchange_rates` |
| argentinadatos.com | Inflación (IPC) y CER/UVA | Diaria (cron) y manual (botón en `/datos` o carga on-demand en `/performance`) | `benchmark_points` |
| Yahoo Finance | Precios actuales e históricos, benchmarks | Diaria (cron) y manual (botones) | `market_price_cache`, `historical_price_cache`, `benchmark_points` |
| Yahoo Finance | Titulares de noticias por acción | Al generar el reporte | No se guardan (solo en el reporte) |
| Anthropic | Reporte de oportunidades | Manual (botón en `/portfolio`) | `portfolio_reports` |
| Yahoo Finance | Cierres y titulares para las alertas | Automático (cron diario) | No se guardan; lo enviado queda en `alert_logs` |
| Gmail (SMTP) | Envío de las alertas | Automático (cron diario) o manual en `/alertas` | — |

Variables de entorno relacionadas: `ANTHROPIC_API_KEY`, `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `ANTHROPIC_TIMEOUT_MS`, `DATABASE_URL` (ver [arquitectura.md](./arquitectura.md#variables-de-entorno)).

La decisión de cachear todo en DB y refrescar solo con botones está registrada en [ADR-0006](./adr/0006-datos-externos-cacheados-en-db-con-refresco-manual.md). Desde [ADR-0021](./adr/0021-actualizacion-diaria-automatica-de-datos-de-mercado.md) el cron diario también los actualiza (antes de las alertas); las pantallas siguen leyendo siempre de la base. La descarga vive en `lib/market-refresh.ts`, compartida por los botones y el cron.
