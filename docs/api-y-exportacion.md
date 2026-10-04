# API routes y exportación

La app evita API routes salvo para (a) binarios/formatos de archivo y (b) la integración con IA ([ADR-0002](./adr/0002-rsc-y-server-actions-api-routes-solo-para-binarios-e-ia.md)). Todas las rutas `/api/*` (excepto `/api/auth`) pasan por el proxy, que exige sesión. Además, **cada ruta valida la sesión por su cuenta** (`401` si falta) y **filtra por `userId`**, de modo que un id ajeno responde `404` ([ADR-0008](./adr/0008-aislamiento-por-usuario-y-datos-de-mercado-globales.md)).

---

## `POST /api/analyze-portfolio` — Análisis con IA

**Archivo:** `app/api/analyze-portfolio/route.ts` · `runtime = "nodejs"` · `maxDuration = 300` (segundos).

### Flujo

1. `getSession()`; sin sesión → `401` `"No autenticado"`. Si el rol no es ADMIN → `403` (mismo criterio que la página `/portfolio`: cada análisis tiene costo).
2. Lee la estrategia activa: `db.investmentStrategy.findFirst({ where: { isActive: true } })`. Si no hay → `500` con `"No hay estrategia de inversión activa configurada. Configurala en /strategy."`.
3. Lee `multipart/form-data`; el archivo va en el campo **`portfolio_pdf`**. Si falta → `400` `"No se recibió ningún archivo."`.
4. Convierte el PDF a base64.
5. Arma un `AbortController` que corta la llamada por **timeout** o si el **cliente cancela** el request (`request.signal`). El timeout es `ANTHROPIC_TIMEOUT_MS`, acotado a `TIMEOUT_CAP_MS = 290000` (default y máximo) para que venza siempre antes que `maxDuration`.
6. Llama a la API de Anthropic con `fetch` directo (sin SDK):

```
POST https://api.anthropic.com/v1/messages
headers:
  x-api-key: process.env.ANTHROPIC_API_KEY
  anthropic-version: 2023-06-01
body:
  model: process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5"
  max_tokens: 32000
  stream: true
  output_config: { effort: process.env.ANTHROPIC_EFFORT ?? "low" }
  system: <InvestmentStrategy.content>              // system prompt versionado
  tools: [{ type: "web_search_20250305", name: "web_search", max_uses: 12 }]
  messages: [{ role: "user", content: [
    { type: "document", source: { type: "base64", media_type: "application/pdf", data } },
    { type: "text", text: <instrucciones> }
  ]}]
```

El prompt de usuario indica que el PDF es la fuente de verdad del estado presente y pide buscar en la web: CCL actual, precio USD y variación mensual de cada ticker relevante, y noticias/catalizadores. Exige responder **solo el objeto JSON**, sin markdown.

7. Lee el stream SSE: acumula los `text_delta`, guarda `stop_reason` y el uso de tokens (`message_start` / `message_delta`). Un evento `error` del stream lanza.
8. Calcula el **costo estimado en USD** con los precios de Sonnet 5 (input $2/MTok, output $10/MTok, cache write $2.5/MTok, cache read $0.2/MTok).
9. `extractJson(rawText)` (`lib/report-normalizer.ts`) quita fences de markdown y recorta el objeto JSON balanceado (ignorando llaves dentro de strings); luego `JSON.parse`.
10. **`normalizarReporte`** (`lib/report-normalizer.ts`, testeado) coerciona y sanea el JSON: valida enums (`estado`, `accion`, `tipo` de alerta, `sesgo`) con mapas de alias, coerciona números, reestructura `posiciones` y `alertas`, garantiza `instruccion_mes`, `no_invertir`, totales y campos raíz. Soporta el esquema legacy `verificacion_suma` en la raíz moviéndolo a `instruccion_mes`.
11. Persiste con `db.portfolioReport.create({ data: { fechaReporte, rawText, normalizedJson, userId } })`. Un fallo de guardado se loguea y **no** aborta la respuesta.
12. Devuelve `200` con el JSON normalizado y el header **`x-estimated-cost-usd`**.

### Errores

| Caso | Respuesta |
|---|---|
| Sin sesión | `401` |
| Usuario sin rol ADMIN | `403` |
| Sin estrategia activa | `500` |
| Sin archivo | `400` |
| Anthropic responde con error HTTP | `500` `"Error al llamar a la API de Claude (modelo <m>): <detalle>"` |
| Anthropic no devuelve stream | `500` |
| Respuesta sin texto | `500`; si `stop_reason = max_tokens`, mensaje específico sugiriendo subir `max_tokens` o achicar la estrategia |
| JSON inválido | `500` + `stop_reason` + `raw` (primeros 4000 caracteres); mensaje específico si se cortó por `max_tokens` |
| Timeout (`ANTHROPIC_TIMEOUT_MS`) | `504` |
| Cancelado por el cliente | `499` |
| Excepción general | `500` `"Error interno del servidor."` |

> **Límites de tiempo:** `maxDuration = 300` s es el tope de la función en Vercel. El timeout propio se acota a 290 s (`TIMEOUT_CAP_MS`) para que corte antes y el cliente reciba el `504` descriptivo; un `ANTHROPIC_TIMEOUT_MS` mayor se ignora. Si se sube `maxDuration` (según el plan de Vercel), subir `TIMEOUT_CAP_MS` en el mismo cambio.

### Consumidor

`components/analysis/portfolio-analizer.tsx` (`PortfolioAnalyzer`, client): arrastra un PDF (react-dropzone, `maxFiles: 1`), hace `fetch("/api/analyze-portfolio", { method: "POST", body: formData, signal })` con la cookie de sesión y permite **cancelar** (aborta el `AbortController`, lo que corta también la llamada a Anthropic). Cachea el último resultado en `localStorage` (`portfolio_reporte_cache`). `ReportHistorial` lista reportes previos del usuario vía las actions `listReports`/`getReport`.

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
| `/api/auth/[...all]` | GET/POST | Endpoints Better Auth | Público |

> **Pendientes conocidos:** los CSV no incluyen BOM UTF-8 (Excel puede mostrar mal los acentos) y las rutas de export no envuelven las consultas a la DB en `try/catch` (un error de DB responde el 500 genérico de Next).
