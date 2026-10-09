# ADR-0021: Actualización diaria automática de los datos de mercado

- **Estado:** Aceptado
- **Fecha:** 2026-10-09
- **Relacionados:** reemplaza en parte a ADR-0006 (el refresco deja de ser solo manual); ADR-0015, ADR-0017, ADR-0020

## Contexto

ADR-0006 decidió cachear en la base los datos externos y refrescarlos solo con botones, porque el uso era mensual. Con el tiempo la app pasó a usarse más seguido (gastos del mes, alertas diarias) y los botones quedaron olvidados: el 9/10 los precios actuales eran del 28/9, los benchmarks del 18/9 y el IPC llegaba a agosto. El P&L no realizado, la Ganancia Real, la comparación contra el S&P 500 y la TIR real mostraban números viejos sin avisarlo.

Desde ADR-0020 ya existe un cron diario.

## Decisión

El cron diario (`/api/cron/alerts`, 9:00 de Argentina) **actualiza primero los datos de mercado globales** y después corre las alertas. Los botones siguen para forzar una actualización en el momento.

- **Qué actualiza** (`refreshMarketData`, `lib/market-refresh.ts`), cada paso por separado: un error en uno no corta al resto.
  - CCL de hoy (dolarapi).
  - Precios actuales de los subyacentes (Yahoo).
  - Cierres históricos de los subyacentes, desde el último guardado de cada ticker.
  - S&P 500, Merval y NASDAQ, desde su último punto.
  - IPC y CER/UVA (argentinadatos).
- **Incremental:** cada serie se pide desde su último dato menos 7 días, porque Yahoo corrige cierres recientes y argentinadatos publica con demora.
- **IPC:** es un índice acumulado base 100 y el nivel de cada mes depende del mes de arranque. `saveInflation` siempre reconstruye **desde el primer punto ya guardado** (o antes, si se pide una fecha anterior), para que los meses nuevos queden en la misma base que los existentes. Esto también corrige un riesgo previo: la carga desde el gráfico de `/performance` podía reescribir parte de la serie con otra base.
- **Invalidación:** el route usa `revalidateTag(tag, "max")` para los tags de los pasos que funcionaron (`updateTag` solo funciona en Server Actions).
- **Una sola implementación:** las Server Actions de los botones (`fetchAndSaveCCL`, `fetchAndSaveMarketPrices`, `fetchAndCacheStockHistory`, `fetchAndSaveBenchmark`, `fetchAndSaveInflation`, `fetchAndSaveCer`) delegan en las mismas funciones de `lib/market-refresh.ts` y conservan sus respuestas.
- **Visibilidad:** `/datos` muestra cuándo se actualizó cada dato y aclara que se actualizan solos.

Sigue valiendo de ADR-0006 lo central: los datos externos se leen siempre de la base, nunca en cada render.

## Alternativas

- **Seguir solo con botones y mostrar la antigüedad de cada dato:** avisa, pero deja el trabajo al usuario, que es justo lo que falló.
- **Refrescar al abrir cada página si el dato es viejo:** pone la red externa en el camino del render, lo que ADR-0006 quería evitar, y choca con el static shell de Cache Components (ADR-0017).
- **Un cron aparte para los datos:** el plan Hobby de Vercel limita la cantidad y frecuencia de crons; una sola corrida diaria alcanza, y ordenarla datos → alertas hace que las alertas usen precios del día.

## Consecuencias

**Positivas**

- Las pantallas muestran datos de, como mucho, un día.
- Las alertas usan los precios del día.

**Negativas / costos**

- Unas 25 llamadas diarias a Yahoo y argentinadatos además de las alertas (medido: 37 s para todo, dentro de los 300 s del cron).
- Si una API cambia o falla, el error queda en la respuesta del cron y en los logs; el dato sigue siendo el último bueno.

**Reglas para el código**

- Toda descarga de datos de mercado nueva va en `lib/market-refresh.ts`, sin invalidar: la Server Action invalida con `updateTag` y el cron con `revalidateTag`.
- No cambiar el mes de arranque del IPC guardado: reconstruirlo desde su primer punto.

## Referencias

- `lib/market-refresh.ts`, `app/api/cron/alerts/route.ts`, `app/actions/{exchange-rate,market-prices,historical-prices,benchmarks,indices}.ts`, `app/(app)/datos/page.tsx`.
