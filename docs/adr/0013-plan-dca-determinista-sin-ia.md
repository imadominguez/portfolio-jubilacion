# ADR-0013: Plan DCA determinista, sin IA

- **Estado:** Aceptado
- **Fecha:** 2026-09-28 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0011

## Contexto

La operatoria mensual es un DCA: cada mes se invierte un aporte repartido entre las posiciones según una asignación objetivo (`TargetAllocation`). El reporte con IA (ADR-0011) incluye una instrucción del mes, pero cuesta dinero, tarda minutos, requiere subir un PDF y puede variar entre corridas para los mismos datos.

La pregunta "¿cuánto compro de cada ticker este mes para acercarme al objetivo?" es aritmética: tiene una respuesta exacta a partir del snapshot, los objetivos y los precios.

## Decisión

Calculamos el plan del mes con una **función pura y determinista**, `planDca()` en `lib/dca-planner.ts`, mostrada en `/plan`:

- Solo reciben aporte los tickers del objetivo (`targetPct > 0`).
- **Gap** de cada ticker = `max(0, targetPct × valorCartera − valorActual)`: cuánto falta para llegar a su peso. Es un techo: nunca se compra más que eso.
- El aporte se reparte por **water-filling** proporcional al gap restante: las posiciones más infraponderadas reciben más, y lo que no entra en un gap se redistribuye entre los demás. El sobrante que no entra en ningún gap se informa como no asignado.
- Los CEDEARs a comprar se estiman con `precio USD del subyacente / ratio × CCL` (o el precio del snapshot).
- Corre en el cliente, así el usuario cambia el monto del aporte y ve el resultado al instante.

## Alternativas

- **Usar solo la instrucción del reporte IA:** cara, lenta y no reproducible.
- **Repartir en proporción al peso objetivo (ignorando el desvío):** no corrige los desbalances acumulados.
- **Vender lo sobreponderado:** el DCA de largo plazo prioriza no vender (costos e impuestos); el rebalanceo con ventas queda como sugerencia aparte en `/rebalance`.

## Consecuencias

**Positivas**

- Instantáneo, gratis, reproducible y testeado (`lib/dca-planner.test.ts`).
- La IA queda para lo que suma: contexto de mercado y noticias.

**Negativas / costos**

- No considera señales de mercado (caídas puntuales, noticias); para eso está el reporte IA.
- Si no hay precio de mercado o ratio para un ticker, la estimación de CEDEARs es aproximada o queda vacía.

**Reglas para el código**

- La lógica del plan vive en `lib/dca-planner.ts` sin Prisma; la página solo junta datos y la pasa.
- Cambios en el algoritmo, con test que cubra el caso.

## Referencias

- `lib/dca-planner.ts`, `lib/dca-planner.test.ts`, `components/plan/dca-planner-client.tsx`, `app/(app)/plan/page.tsx`.
- Commit `153a61a`. [`logica-financiera.md`](../logica-financiera.md#plan-dca-libdca-plannerts).
