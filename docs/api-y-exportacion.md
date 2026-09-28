# API routes y exportación

La app evita API routes salvo para (a) binarios/formatos de archivo y (b) la integración con IA. Todas las rutas `/api/*` pasan por el middleware, que exige sesión (excepto `/api/auth`), pero **no** validan rol ni ownership internamente.

---

## `POST /api/analyze-portfolio` — Análisis con IA

**Archivo:** `app/api/analyze-portfolio/route.ts`

### Flujo

1. Lee la estrategia activa: `db.investmentStrategy.findFirst({ where: { isActive: true } })`. Si no hay → `500` con `"No hay estrategia de inversión activa configurada. Configurala en /strategy."`.
2. Lee `multipart/form-data`; el archivo va en el campo **`portfolio_pdf`**. Si falta → `400` `"No se recibió ningún archivo."`.
3. Convierte el PDF a base64.
4. Llama a la API de Anthropic:

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

5. Extrae el texto de los bloques `type === "text"`, recorta desde el primer `{` al último `}` y hace `JSON.parse`.
6. **`normalizarReporte`** coerciona y sanea el JSON: valida enums (`estado`, `accion`, `tipo` de alerta, `sesgo`) con mapas de alias, coerciona números, reestructura `posiciones` y `alertas`, garantiza `instruccion_mes`, `no_invertir`, totales y campos raíz. Soporta el esquema legacy `verificacion_suma` en la raíz moviéndolo a `instruccion_mes`.
7. Persiste con `db.portfolioReport.create({ data: { fechaReporte, rawText, normalizedJson } })` (sin `userId`). Un fallo de guardado se loguea y **no** aborta la respuesta.
8. Devuelve `200` con el JSON normalizado.

### Errores

| Caso | Respuesta |
|---|---|
| Sin estrategia activa | `500` |
| Sin archivo | `400` |
| Anthropic no responde OK | `500` `"Error al llamar a la API de Claude."` |
| JSON inválido | `500` `"La respuesta de Claude no fue JSON válido."` + `raw` |
| Excepción general | `500` `"Error interno del servidor."` |

### Consumidor

`components/analysis/portfolio-analizer.tsx` (`PortfolioAnalyzer`, client): arrastra un PDF (react-dropzone, `maxFiles: 1`), hace `fetch("/api/analyze-portfolio", { method: "POST", body: formData })` con la cookie de sesión, y cachea el resultado en `localStorage` (`portfolio_reporte_cache`). `ReportHistorial` lista reportes previos vía las actions `listReports`/`getReport`.

---

## `GET /api/export/pdf/[snapshotId]` — PDF

**Archivo:** `app/api/export/pdf/[snapshotId]/route.ts`

1. `db.portfolioSnapshot.findUnique` con `positions` ordenadas por valor desc. Si no existe → `404`.
2. Calcula la **concentración por sector** cruzando posiciones con `Asset` (`sector`), agrupando por sector y calculando porcentajes.
3. Renderiza `PortfolioPDF` con `renderToBuffer` de `@react-pdf/renderer` (`createElement`, sin JSX en el server).
4. Responde `application/pdf`, `Content-Disposition: attachment; filename="portfolio-<YYYY-MM-DD>.pdf"`.

El documento (`components/export/portfolio-pdf.tsx`) usa A4, fuente Inter (registrada desde Google Fonts), KPIs (ARS, USD, CCL, posiciones), tabla de holdings (con `allocationPct × 100`) y hasta 10 sectores. Los `Decimal` se convierten con `Number(...)`.

---

## `GET /api/export/snapshot/[id]` — CSV o HTML imprimible

**Archivo:** `app/api/export/snapshot/[id]/route.ts`

- Busca el snapshot; `404` si no existe.
- **`?format=csv`:** CSV con header `Ticker,Instrumento,Cantidad,Precio ARS,Valor ARS,Asignación %`, instrumento entre comillas con escape, `Content-Disposition: attachment; filename="portfolio-<fecha>.csv"`.
- **Por defecto (HTML):** documento HTML completo con estilos inline y `@media print` (KPIs, tabla de posiciones, footer). Sin `Content-Disposition`; pensado para vista previa e impresión.

---

## `GET /api/export/transactions` — CSV de transacciones

**Archivo:** `app/api/export/transactions/route.ts`

- `db.transaction.findMany({ orderBy: { date: "desc" } })` — **sin filtro por `userId`**.
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
| `/api/analyze-portfolio` | POST | JSON normalizado | Sesión (middleware) |
| `/api/export/pdf/[snapshotId]` | GET | PDF (attachment) | Sesión |
| `/api/export/snapshot/[id]` | GET | CSV o HTML imprimible | Sesión |
| `/api/export/transactions` | GET | CSV | Sesión |
| `/api/auth/[...all]` | GET/POST | Endpoints Better Auth | Público |

> **Nota de seguridad:** las rutas de exportación y análisis no filtran por `userId`; cualquier usuario autenticado que conozca un id puede exportar ese snapshot/transacción. Tampoco incluyen BOM UTF-8 en los CSV (puede afectar acentos en Excel) ni `try/catch` en los exports.
