# ADR-0018: Reporte de oportunidades por acción con datos preparados por la app

- **Estado:** Aceptado
- **Fecha:** 2026-10-08
- **Relacionados:** reemplaza a ADR-0011; ADR-0002, ADR-0006, ADR-0007, ADR-0013, ADR-0016

## Contexto

El reporte mensual de ADR-0011 subía el PDF de tenencia de Cocos y le pedía a Claude que buscara en la web (hasta 12 búsquedas) el CCL, los precios y las noticias, y que devolviera un plan de aporte con asignaciones por porcentaje. Tres cosas lo hacían caro (~US$ 0,30–0,50 estimado por reporte):

- El PDF se procesa como texto más imagen por página.
- Cada búsqueda web cobra aparte y agrega miles de tokens de resultados, que el modelo relee en cada paso.
- El JSON de asignaciones es largo.

Además, el costo informado estaba mal: suponía siempre Sonnet 5 y no contaba las búsquedas.

El autor quiere otra cosa del reporte: no porcentajes de tenencia, sino que revise el precio de cada acción que tiene y las noticias de la empresa y diga si es oportunidad de compra o de venta. El reparto del aporte ya lo resuelve el Plan DCA sin IA (ADR-0013).

## Decisión

El reporte pasa a ser **de oportunidades por acción**, y **la app prepara los datos**: Claude solo recibe una tabla compacta y aporta el juicio.

- **Fuente de la tenencia:** el último snapshot importado (ya no se sube el PDF), con el precio promedio de compra (PPM) y el subyacente de cada CEDEAR (`getAssetCatalog`).
- **Precios:** la app baja el último año diario de cada subyacente de Yahoo (`getHistorical`) y calcula las señales con `priceSignals` (`lib/opportunity-signals.ts`): variación de 1, 3 y 12 meses y distancia al máximo y mínimo de 52 semanas. Es un dato de entrada del reporte, no se persiste (el refresco manual de ADR-0006 aplica a las pantallas, no a esta acción explícita).
- **Noticias:** titulares recientes de la búsqueda pública de Yahoo (`getNews`, gratis), filtrados por `selectNews`: solo notas cuyo ticker principal es la acción o que la nombran en el título, de los últimos 30 días, sin duplicados, hasta 5. Claude no busca en la web.
- **Modelo:** Claude Sonnet 5.5 (`claude-sonnet-5-5`, reemplazable con `ANTHROPIC_MODEL`), thinking adaptativo con `effort` configurable (`low` por defecto) y `fallbacks: "default"` (beta `server-side-fallback-2026-07-01`) para que un rechazo de los clasificadores se reintente en otro modelo.
- **Salida:** structured output con `OpportunityAnalysisSchema` (Zod): resumen y, por acción, señal `compra` / `mantener` / `venta`, confianza y una lectura corta de precio, noticias, motivo y riesgos. La respuesta siempre valida contra el esquema, así que se elimina la normalización tolerante (`lib/report-normalizer.ts`).
- **Estrategia:** sigue siendo la fila activa de `InvestmentStrategy` (versionada, editable en `/strategy`), pero ahora solo define el **criterio** (perfil de largo plazo y oportunista, cuándo es compra o venta). El formato lo fija el esquema, así que editar el prompt no puede romper el JSON.
- **SDK oficial** (`@anthropic-ai/sdk`, `client.beta.messages.parse`) en lugar de `fetch` + parseo SSE propio: lo pide el structured output tipado con Zod y el manejo de errores tipado.
- **Costo:** se calcula con los tokens reales y el precio del **modelo que respondió** (`estimateCostUsd`, tabla `MODEL_PRICING`; `null` si el modelo no está en la tabla) y se guarda en el reporte (`uso`).
- **Persistencia:** igual que antes, en `PortfolioReport`. Los reportes nuevos llevan `version: 2`; los anteriores siguen visibles en el historial con su visor (`components/analysis/legacy-report.tsx`).

## Alternativas

- **Seguir con búsqueda web de Claude para las noticias:** mejor cobertura y contexto, pero era la parte más cara del costo. Queda como opción (por ejemplo, búsquedas solo para las acciones marcadas como compra o venta) si los titulares resultan insuficientes.
- **Haiku 4.5:** cerca de la mitad del costo (~US$ 0,03), pero razonamiento más simple al pesar noticias contra el precio. Se eligió Sonnet 5.5; el modelo se puede cambiar por variable de entorno y el costo se recalcula solo.
- **Mantener el PDF como fuente:** el snapshot ya tiene los mismos datos estructurados, sin costo de tokens de imagen.
- **Conservar el plan de asignaciones con IA:** el autor no quiere porcentajes de tenencia en el reporte, y el reparto ya es determinista (ADR-0013).

## Consecuencias

**Positivas**

- Costo por reporte estimado en ~US$ 0,035–0,07 con Sonnet 5.5 (entrada de ~3.000 tokens para 14 acciones), de 6 a 10 veces menos que antes, y ahora medido y guardado en cada reporte.
- Más rápido (sin búsquedas web: segundos de Yahoo más una sola respuesta del modelo) y sin JSON inválido.
- Las métricas de precio son deterministas y testeadas; el modelo no las inventa.

**Negativas / costos**

- Las noticias son solo titulares (sin el cuerpo de la nota) y la búsqueda de Yahoo trae algo de ruido que el filtro no elimina del todo.
- Los CEDEARs sin subyacente en Yahoo (acciones locales, bonos) quedan fuera del análisis (`posiciones_sin_datos`).
- Requiere un snapshot importado; analiza la tenencia de ese snapshot, no la del día.
- Al cambiar el prompt hay que activarlo en la base (`pnpm db:strategy`) **después** de desplegar el código nuevo: el código anterior espera el prompt con el esquema de asignaciones.

**Reglas para el código**

- Cambios al formato del reporte: actualizar juntos `OpportunityAnalysisSchema` y sus tests, `OpportunityReportDisplay` y, si hace falta, el criterio en `lib/default-strategy.ts`. No volver a describir el JSON en el prompt.
- Todo dato numérico que Claude necesite se calcula en `lib/` (puro, con tests) y se le pasa en `buildAnalysisInput`; el modelo no busca precios.
- Al cambiar de modelo, agregar sus precios a `MODEL_PRICING`.
- Nunca editar una versión de `InvestmentStrategy` existente: siempre crear una nueva (igual que ADR-0011).
- La llamada sigue en un route handler (ADR-0002), con timeout acotado por debajo de `maxDuration` y cancelación desde el cliente.

## Referencias

- `app/api/analyze-portfolio/route.ts`, `lib/opportunity-signals.ts`, `lib/opportunity-report.ts`, `lib/yahoo-finance-client.ts` (`getNews`), `lib/default-strategy.ts`, `components/analysis/opportunity-*.tsx`.
- Referencia de la API de Claude: structured outputs (`output_config.format`), thinking adaptativo y `fallbacks`.
