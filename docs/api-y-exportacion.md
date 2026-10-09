# API routes y exportación

La app evita API routes salvo para (a) binarios/formatos de archivo, (b) la integración con IA ([ADR-0002](./adr/0002-rsc-y-server-actions-api-routes-solo-para-binarios-e-ia.md)) y (c) el cron de alertas ([ADR-0020](./adr/0020-alertas-por-mail-con-cron-y-gmail-smtp.md)). Todas las rutas `/api/*` (excepto `/api/auth` y `/api/cron`, que valida `CRON_SECRET`) pasan por el proxy, que exige sesión. Además, **cada ruta valida la sesión por su cuenta** (`401` si falta) y **filtra por `userId`**, de modo que un id ajeno responde `404` ([ADR-0008](./adr/0008-aislamiento-por-usuario-y-datos-de-mercado-globales.md)).

---

## `POST /api/analyze-portfolio` — Reporte de oportunidades con IA

**Archivo:** `app/api/analyze-portfolio/route.ts` · runtime Node.js (default) · `maxDuration = 300` (segundos). Decisión y motivos: [ADR-0018](./adr/0018-reporte-de-oportunidades-con-datos-preparados-por-la-app.md).

Sin cuerpo: analiza el **último snapshot importado** del usuario. La app prepara los datos y Claude solo devuelve una señal por acción.

### Flujo

1. `getSession()`; sin sesión → `401` `"No autenticado"`. Si el rol no es ADMIN → `403` (cada análisis tiene costo).
2. Lee la estrategia activa (`InvestmentStrategy` con `isActive`), que es el system prompt con el **criterio** de inversión. Si no hay → `500`.
3. En paralelo: `getLatestSnapshot()`, `calculatePPM()` (precio promedio de compra en ARS) y `getAssetCatalog()` (subyacente de cada CEDEAR). Sin snapshot → `400`.
4. Por cada posición con subyacente, de a 4 en paralelo:
   - `getHistorical(subyacente, último año)` → `priceSignals` (`lib/opportunity-signals.ts`): variación de 1, 3 y 12 meses y distancia al máximo y mínimo de 52 semanas.
   - `getNews(subyacente)` → `selectNews`: titulares de los últimos 30 días cuyo ticker principal es la acción o que la nombran en el título, sin duplicados, hasta 5.
   - Una posición sin subyacente o con error de Yahoo queda en `posiciones_sin_datos` y no corta el reporte. Si ninguna tiene datos → `502`.
5. `buildAnalysisInput` (`lib/opportunity-report.ts`) arma un texto compacto por acción (medido: 6.222 tokens de entrada para 14 acciones, incluido el prompt de estrategia).
6. Llama a Claude con el SDK oficial:

```ts
client.beta.messages.parse({
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5-5",
  max_tokens: 16000,
  system: <InvestmentStrategy.content>,
  messages: [{ role: "user", content: <entrada compacta> }],
  output_config: { format: betaZodOutputFormat(OpportunityAnalysisSchema), effort: ANTHROPIC_EFFORT ?? "low" },
  thinking: { type: "adaptive" },
  betas: ["server-side-fallback-2026-07-01"],
  fallbacks: "default",
}, { signal: request.signal })
```

   Cada parámetro se manda solo a los modelos que lo aceptan (`modelRequestOptions`, en `lib/opportunity-report.ts`): `thinking` y `effort` a las familias 4.6 en adelante (incluido `claude-sonnet-5`); `fallbacks` solo a Sonnet 5.5, Opus 5.5, Opus 5 y Fable 5.1. Con Haiku 4.5 no se manda ninguno. El cliente usa `timeout = ANTHROPIC_TIMEOUT_MS` (acotado a `TIMEOUT_CAP_MS = 290000`) y `maxRetries: 1`.
7. La respuesta valida contra `OpportunityAnalysisSchema` (structured output): `resumen` y, por acción, `senal` (`compra` / `mantener` / `venta`), `confianza` (`alta` / `media` / `baja`), `precio`, `noticias`, `motivo` y `riesgos`.
8. Calcula el costo con `estimateCostUsd(response.model, usage)`: precios del modelo que respondió (`MODEL_PRICING`), `null` si no está en la tabla.
9. Guarda en `PortfolioReport` (`fechaReporte`, `rawText` = JSON de la respuesta, `normalizedJson` = el reporte con `version: 2`, `snapshot_fecha`, `posiciones_sin_datos` y `uso`). Un fallo al guardar se loguea y **no** aborta la respuesta.
10. Devuelve `200` con el reporte.

### Errores

| Caso | Respuesta |
|---|---|
| Sin sesión | `401` |
| Usuario sin rol ADMIN | `403` |
| Sin estrategia activa | `500` |
| Sin snapshot importado | `400` |
| Ninguna posición con precios | `502` |
| Claude declina (`stop_reason: "refusal"`, después del fallback) | `502` |
| Respuesta cortada por `max_tokens` o sin el formato esperado | `500` + `stop_reason` |
| Timeout (`ANTHROPIC_TIMEOUT_MS`) | `504` |
| Cancelado por el cliente | `499` |
| Rate limit de la API de Claude | `429` |
| Otro error de la API de Claude | `500` `"Error al llamar a la API de Claude: <detalle>"` |
| Excepción general | `500` `"Error interno del servidor."` |

> **Límites de tiempo:** `maxDuration = 300` s es el tope de la función en Vercel. El timeout propio se acota a 290 s (`TIMEOUT_CAP_MS`) para que corte antes y el cliente reciba el `504` descriptivo. En la práctica el reporte tarda segundos de Yahoo más una sola respuesta del modelo.

### Consumidor

`components/analysis/opportunity-analyzer.tsx` (`OpportunityAnalyzer`, client): botón "Generar reporte", `fetch("/api/analyze-portfolio", { method: "POST", signal })` y **Cancelar** (aborta también la llamada a Claude). Guarda el último reporte en `localStorage` (`portfolio_reporte_oportunidades`) y lo muestra con `OpportunityReportDisplay`. `ReportHistorial` lista los reportes previos (`listReports` / `getReport`) y muestra cada uno con su visor: `OpportunityReportDisplay` si es `version: 2`, o `ReporteDisplay` (`legacy-report.tsx`) para los del formato anterior.

---

## `GET /api/export/pdf/[snapshotId]` — PDF

**Archivo:** `app/api/export/pdf/[snapshotId]/route.ts`

1. `requireUserId()`; sin sesión → `401`.
2. `db.portfolioSnapshot.findFirst({ where: { id: snapshotId, userId } })` con `positions` ordenadas por valor desc. Si no existe (o es de otro usuario) → `404`.
3. Calcula la **concentración por sector** cruzando posiciones con `Asset` (`sector`, `"Sin clasificar"` si falta), agrupando y calculando porcentajes.
4. Renderiza `PortfolioPDF` con `renderToBuffer` de `@react-pdf/renderer` (`createElement`, sin JSX en el route).
5. Responde `application/pdf`, `Content-Disposition: attachment; filename="portfolio-<YYYY-MM-DD>.pdf"`.

El documento (`components/export/portfolio-pdf.tsx`) usa A4, fuente Inter (registrada desde Google Fonts), KPIs (ARS, USD, CCL, posiciones), tabla de holdings (con `allocationPct × 100`) y hasta 10 sectores. Los `Decimal` se convierten con `Number(...)`. Sin Tailwind ni shadcn: solo primitivas de react-pdf y `StyleSheet.create()`.

---

## `GET /api/export/snapshot/[id]` — CSV o HTML imprimible

**Archivo:** `app/api/export/snapshot/[id]/route.ts`

- `requireUserId()` (`401`) y `findFirst({ where: { id, userId } })` (`404` si no existe o es ajeno).
- **`?format=csv`:** CSV con header `Ticker,Instrumento,Cantidad,Precio ARS,Valor ARS,Asignación %`, instrumento entre comillas con escape, `Content-Disposition: attachment; filename="portfolio-<fecha>.csv"`.
- **Por defecto (HTML):** documento HTML completo con estilos inline y `@media print` (KPIs, tabla de posiciones, footer), formateado con `lib/format.ts`. Sin `Content-Disposition`; pensado para vista previa e impresión.

---

## `GET /api/export/transactions` — CSV de transacciones

**Archivo:** `app/api/export/transactions/route.ts`

- `requireUserId()` (`401`) y `db.transaction.findMany({ where: { userId }, orderBy: { date: "desc" } })`.
- Header `Fecha,Tipo,Ticker,Cantidad,Precio,Moneda,Comisión,Notas`; `fee` vacío si es null; notas escapadas.
- `Content-Disposition: attachment; filename="transacciones-<YYYY-MM-DD>.csv"`.

---

## `GET /api/export/impuestos?anio=AAAA` — CSV del reporte para impuestos

**Archivo:** `app/api/export/impuestos/route.ts`

- `requireUserId()` (`401`); `anio` no entero → `400`.
- `getTaxData()` (filtra por el usuario de la sesión) → `buildTaxReport` → `taxReportCsv` (`lib/tax-report.ts`).
- Tres secciones (tenencia al cierre, ventas, dividendos) separadas por una línea vacía. Pensado para Excel en español: BOM UTF-8, separador `;`, coma decimal y fechas `AAAA-MM-DD`.
- Errores de la DB → `500` con JSON. `Content-Disposition: attachment; filename="impuestos-<AAAA>.csv"`.

---

## `GET /api/cron/alerts` — Alertas diarias

**Archivo:** `app/api/cron/alerts/route.ts` · `maxDuration = 300`. Decisión: [ADR-0020](./adr/0020-alertas-por-mail-con-cron-y-gmail-smtp.md).

- Lo llama Vercel Cron (`vercel.json`, `0 12 * * *` = 9:00 en Argentina) con `Authorization: Bearer <CRON_SECRET>`. Sin el header correcto (o sin `CRON_SECRET` configurado) → `401`. El proxy no le pide sesión.
- Primero `refreshMarketData()` (`lib/market-refresh.ts`, [ADR-0021](./adr/0021-actualizacion-diaria-automatica-de-datos-de-mercado.md)): CCL, precios, históricos, benchmarks, IPC y CER, de forma incremental; después `revalidateTag(tag, "max")` de los pasos que funcionaron.
- Después `runAllAlerts()` (`lib/alerts-runner.ts`) recorre los usuarios con `AlertSettings.enabled`; un usuario que falla no corta al resto.
- Responde el estado de cada paso de datos y conteos de alertas: `{ market: [{ step, ok, detail }], users, failed, mailsSent, drops, reminders }` (nada de datos de usuarios). Error inesperado → `500`.

---

## Componentes de exportación

| Componente | Tipo | Función |
|---|---|---|
| `components/export/export-buttons.tsx` | Client | Dropdown con: Descargar PDF, Imprimir / Vista previa (abre HTML y llama `win.print()` al terminar de cargar) y Descargar CSV. Usa `useTransition` y toasts. |
| `components/export/csv-export-button.tsx` | Client | Botón simple que abre un `href` en nueva pestaña (usado para `/api/export/transactions`). |
| `components/export/portfolio-pdf.tsx` | Server | Documento `@react-pdf/renderer`. |

---

## Resumen

| Ruta | Método | Salida | Auth |
|---|---|---|---|
| `/api/analyze-portfolio` | POST | JSON normalizado + `x-estimated-cost-usd` | Sesión + rol ADMIN |
| `/api/export/pdf/[snapshotId]` | GET | PDF (attachment) | Sesión + ownership |
| `/api/export/snapshot/[id]` | GET | CSV o HTML imprimible | Sesión + ownership |
| `/api/export/transactions` | GET | CSV | Sesión + ownership |
| `/api/export/impuestos?anio=` | GET | CSV (BOM, `;`) | Sesión + ownership |
| `/api/cron/alerts` | GET | JSON con conteos | `CRON_SECRET` (sin sesión) |
| `/api/auth/[...all]` | GET/POST | Endpoints Better Auth | Público |

> **Pendientes conocidos:** salvo el de impuestos, los CSV no incluyen BOM UTF-8 (Excel puede mostrar mal los acentos) y las rutas de export no envuelven las consultas a la DB en `try/catch` (un error de DB responde el 500 genérico de Next).
