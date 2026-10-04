# ADR-0011: Análisis mensual con Claude y estrategia versionada como system prompt

- **Estado:** Aceptado
- **Fecha:** 2026-05-09; endurecido el 2026-09-28 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0002, ADR-0006, ADR-0013

## Contexto

Además de las métricas calculadas, el autor quiere un **reporte mensual** que lea la tenencia real, la contraste con su estrategia de inversión (DCA oportunístico en CEDEARs) y con el contexto de mercado del mes (CCL, precios, noticias), y proponga qué hacer. Eso requiere razonamiento y búsqueda web, no solo fórmulas.

La estrategia cambia con el tiempo y tiene que poder ajustarse sin redeploy, conservando qué estrategia generó cada reporte. Los LLMs devuelven a veces JSON incompleto, con fences de markdown o con enums escritos distinto.

## Decisión

- **Fuente:** el PDF de tenencia de Cocos, subido en `/portfolio` y enviado como documento base64. El PDF es la fuente de verdad del estado presente.
- **Modelo:** Claude (`claude-sonnet-5` por defecto, configurable con `ANTHROPIC_MODEL`), con la tool `web_search` (`max_uses: 12`), `effort` configurable (`low` por defecto para acotar costo y evitar cortes por `max_tokens`) y **streaming**.
- **Estrategia como dato:** el system prompt es la fila activa de `InvestmentStrategy`. Es **versionada e inmutable**: guardar crea la versión N+1 activa y restaurar reactiva una anterior. Se edita en `/strategy` (solo ADMIN). La versión por defecto vive en `lib/default-strategy.ts` (compacta para bajar tokens de entrada) y se carga con el seed o `npm run db:strategy`.
- **Salida tolerante:** `extractJson` + `normalizarReporte` (`lib/report-normalizer.ts`, puro y testeado) coercionan el JSON a un esquema estable (alias de enums, números, campos obligatorios, compatibilidad con el esquema legacy).
- **Persistencia:** cada reporte se guarda en `PortfolioReport` (texto crudo + JSON normalizado + `userId`), porque el filesystem de Vercel es efímero y el historial importa.
- **Llamada directa con `fetch`** a la API de Anthropic, en un route handler (`POST /api/analyze-portfolio`), con timeout configurable, cancelación desde el cliente y costo estimado devuelto en el header `x-estimated-cost-usd`.

## Alternativas

- **SDK oficial de Anthropic:** tipado y con helpers de streaming. Se optó por `fetch` directo, sin dependencia extra; el parseo SSE es corto y está en el route. Si el uso crece (más tools, reintentos), migrar al SDK es razonable.
- **Estrategia hardcodeada en el código:** cambiarla requiere deploy y se pierde la trazabilidad de qué versión generó qué reporte.
- **Calcular las recomendaciones sin IA:** se hizo para la parte determinista (ADR-0013); el reporte aporta lectura de contexto y noticias que una fórmula no da.
- **Confiar en el JSON del modelo sin normalizar:** la UI se rompe ante el primer campo faltante.

## Consecuencias

**Positivas**

- La estrategia se ajusta desde la UI, con historial y rollback.
- La UI siempre recibe un reporte con forma estable, aunque el modelo se desvíe.
- Costo visible por llamada.

**Negativas / costos**

- Cada análisis cuesta dinero y puede tardar minutos.
- Un análisis no puede pasar de ~5 min: `maxDuration = 300` s y el timeout propio se acota a 290 s.
- Los precios usados para estimar el costo están hardcodeados para Sonnet 5.
- Analizar y editar la estrategia es exclusivo de ADMIN (route con `403`, actions con `requireAdmin()`).
- `InvestmentStrategy` es global: todos los usuarios comparten la estrategia activa.

**Reglas para el código**

- Cambios al esquema del reporte: actualizar juntos la estrategia (`lib/default-strategy.ts`), `normalizarReporte` y sus tests, y `ReporteDisplay`.
- Nunca editar una versión de `InvestmentStrategy` existente: siempre crear una nueva.
- No mover la llamada al render ni a una action (ADR-0002).

## Referencias

- `app/api/analyze-portfolio/route.ts`, `lib/report-normalizer.ts`, `lib/default-strategy.ts`, `app/actions/strategy.ts`.
- Commits `a792d74`, `b78cd94`, `eabceb9`, `9fd5cbc`.
- [`api-y-exportacion.md`](../api-y-exportacion.md#post-apianalyze-portfolio--análisis-con-ia).
