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
- Usado por `parseCocosMovimientosCsv` / `importMovimientos` (`app/actions/import-movements.ts`).

### C) PDF de tenencia

- Se sube desde `/portfolio` y se envía a Anthropic para el análisis mensual.

Guía visual y capturas: `components/guide/cocos-guide.tsx` (ruta `/guia`), con imágenes en `public/guides/cocos/`.

---

## 2. dolarapi.com — CCL actual

- Endpoint: `GET https://dolarapi.com/v1/dolares/contadoconliqui` (`cache: "no-store"`).
- Campo usado: `venta ?? compra`.
- Se guarda por fecha (medianoche local) en `ExchangeRate` con `source: "dolarapi.com"`.
- Implementado en `fetchAndSaveCCL` (`app/actions/exchange-rate.ts`).
- Disparado desde `CclUpdateButton` (Assets) y como parte del wizard de ganancia real.

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

- Implementado en `app/actions/indices.ts` (`fetchAndSaveInflation`, `fetchAndSaveCer`).
- El IPC se compone con `buildCumulativeIndex` (`lib/inflation.ts`) porque la API entrega **tasas**, no un índice.
- No existe endpoint `/cer` en argentinadatos; **UVA** es el índice diario basado en CER.
- La lectura (`getIndexPoints`) reutiliza `getBenchmarkPoints`, que normaliza a base 100.

---

## 4. Yahoo Finance — precios

Cliente propio en `lib/yahoo-finance-client.ts` (no usa `yahoo-finance2`). Implementa el flujo **cookie + crumb** que Yahoo exige desde 2023.

### Autenticación

- `getAuth()` (interna):
  1. `GET https://fc.yahoo.com` con User-Agent de Chrome para obtener cookies de sesión.
  2. `GET https://query1.finance.yahoo.com/v1/test/getcrumb` (fallback a `query2`) para el crumb.
  3. Cachea cookie + crumb a nivel de módulo con TTL de **23 horas**.
- Si falla la cookie → lanza `"No se pudo obtener la cookie de sesión de Yahoo Finance."`; si falla el crumb → `"No se pudo obtener el crumb de Yahoo Finance (<status>)."`.

### Endpoints

| Función | Endpoint | Uso |
|---|---|---|
| `getQuotes(symbols)` | `/v7/finance/quote?symbols=...&crumb=...` | Precio actual; `regularMarketPrice ?? ask ?? bid`. |
| `getHistorical(symbol, from, to)` | `/v8/finance/chart/:symbol?interval=1d&period1=...&period2=...` | Cierres diarios. |

`getHistorical` filtra velas sin `close` o `≤ 0` y normaliza la fecha a medianoche UTC (`setUTCHours(0,0,0,0)`) para coincidir con `@db.Date`.

### Persistencia y consumidores

| Action | Función Yahoo | Tabla destino |
|---|---|---|
| `market-prices.ts` | `getQuotes` | `MarketPriceCache` (upsert por ticker subyacente, USD) |
| `historical-prices.ts` | `getHistorical` | `HistoricalPriceCache` (upsert `ticker`+`date`) |
| `benchmarks.ts` | `getHistorical` | `BenchmarkPoint` (upsert `benchmarkId`+`date`) |

- El histórico de subyacentes se pide desde la primera compra (o −365 días si no hay) hasta hoy.
- Los tickers subyacentes provienen del campo `Asset.underlyingTicker`.

### Limitaciones conocidas

- Sin `AbortController`/timeout: un cuelgue de red bloquea la server action.
- La caché de auth puede expirar antes de 23 h; no hay reintento de re-auth automático (solo fallback `query1 → query2`).

---

## 5. Anthropic (Claude) — análisis mensual

- Endpoint: `POST https://api.anthropic.com/v1/messages` con **streaming** (`stream: true`).
- Variables de entorno: `ANTHROPIC_API_KEY` (obligatoria), `ANTHROPIC_MODEL` (default `claude-sonnet-5`), `ANTHROPIC_EFFORT` (default `low`: `low|medium|high|max`), `ANTHROPIC_TIMEOUT_MS` (default `900000`, 15 min).
- Modelo: `process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"`, `max_tokens: 32000`, `output_config: { effort: process.env.ANTHROPIC_EFFORT ?? "low" }`.
- El `effort` controla cuánto "piensa" Sonnet 5 (thinking adaptativo). Bajarlo reduce tokens de salida, costo y evita cortes por `max_tokens`.
- El route loguea por corrida: `stop_reason`, tipos de bloque, tokens (input / cache_write / cache_read / output / thinking) y **costo estimado en USD** usando los precios de Sonnet 5 (input $2/MTok, output $10/MTok, cache write 1.25×, cache read 0.1×).
- Tool: `web_search_20250305` (`web_search`, `max_uses: 12`) para consultar CCL, precios y noticias.
- `system` = contenido de la `InvestmentStrategy` activa (editable y versionada en `/strategy`).
- Entrada: el PDF de tenencia de Cocos en base64 + instrucciones.
- La respuesta se lee como SSE y se acumulan los `text_delta`; se parsea el JSON del mensaje.
- Salida: JSON normalizado que se guarda en `PortfolioReport` y se muestra en `/portfolio`.

Detalle completo en [api-y-exportacion.md](./api-y-exportacion.md#post-apianalyze-portfolio--análisis-con-ia).

---

## Resumen

| Fuente | Dato | Actualización | Cache |
|---|---|---|---|
| Cocos Capital (CSV) | Posiciones y movimientos | Manual (importación) | DB (`portfolio_snapshots`, `transactions`) |
| Cocos Capital (PDF) | Tenencia para IA | Manual (upload) | DB (`portfolio_reports`) |
| dolarapi.com | CCL actual | Manual (botón) | `exchange_rates` |
| argentinadatos.com | CCL histórico | Manual (wizard/backfill) | `exchange_rates` |
| argentinadatos.com | Inflación (IPC) y CER/UVA | Manual (botón en `/performance`) | `benchmark_points` |
| Yahoo Finance | Precios actuales e históricos | Manual (botones) | `market_price_cache`, `historical_price_cache`, `benchmark_points` |
| Anthropic | Análisis mensual | Manual (upload PDF) | `portfolio_reports` |

Variables de entorno relacionadas: `ANTHROPIC_API_KEY`, `DATABASE_URL` (ver [arquitectura.md](./arquitectura.md#variables-de-entorno)).
