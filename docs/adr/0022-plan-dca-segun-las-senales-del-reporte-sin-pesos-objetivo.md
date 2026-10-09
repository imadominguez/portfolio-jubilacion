# ADR-0022: Plan DCA según las señales del reporte, sin pesos objetivo

- **Estado:** Aceptado
- **Fecha:** 2026-10-09
- **Relacionados:** reemplaza a ADR-0013; ADR-0018

## Contexto

El Plan DCA (ADR-0013) repartía el aporte del mes para acercar cada acción a un **peso objetivo** (`TargetAllocation`, editado en `/rebalance`), con un tope por acción: nunca se compraba más de lo que faltaba para llegar a su peso. La página de Rebalanceo comparaba esos objetivos contra la tenencia y sugería comprar o vender.

El autor no quiere pesos objetivo ni topes de tenencia por acción. Su estrategia es de largo plazo y oportunista: comprar lo que está en oportunidad, que es justo lo que dice el reporte de oportunidades (ADR-0018), con una señal (compra, mantener o venta) y una confianza por acción.

## Decisión

El Plan DCA reparte el aporte según las **señales del último reporte de oportunidades**. Se eliminan los pesos objetivo, la página de Rebalanceo y la tabla `target_allocations`.

- **Universo:** las acciones del último snapshot con subyacente (CEDEARs). El FCI y las acciones locales no tienen señal y no reciben aporte.
- **Con reporte:** el aporte va a las acciones marcadas "compra", proporcional a su confianza (alta 3, media 2, baja 1). Si ninguna está en "compra", se reparte en partes iguales entre las "mantener". "Venta" nunca recibe. Si todo es "venta", el plan no asigna el aporte.
- **Sin reporte** (por ejemplo, un usuario que no es ADMIN y no puede generarlo): partes iguales entre todas.
- **Sin topes:** una sola acción en "compra" se lleva todo el aporte.
- **Señales viejas:** si el último reporte tiene más de 45 días, `/plan` lo avisa y sugiere generar uno nuevo.
- **Sigue siendo una función pura y determinista** (`planDca`, `lib/dca-planner.ts`): dado el mismo reporte, el mismo snapshot y el mismo aporte, da siempre el mismo plan. La IA solo interviene al generar el reporte, que es una acción explícita del usuario.
- **Dashboard:** la tarjeta de Rebalanceo pasa a ser la del Plan DCA (cuántas acciones están en "compra"). La puesta en marcha deja de pedir objetivos; el paso de preferencias es el plan de retiro.

## Alternativas

- **Mantener los objetivos y sumar las señales como ajuste** (no dar aporte a "venta", pesar más a "compra" dentro del tope): el autor no quiere topes ni pesos objetivo.
- **Partes iguales siempre:** ignora la información del reporte, que es la base de la estrategia.
- **Que el usuario elija a mano:** posible, pero deja la decisión de todos los meses afuera de la app.
- **Conservar `/rebalance` sin usarlo en el plan:** dejaría una herramienta con un modelo de cartera (pesos objetivo) que el autor descartó.

## Consecuencias

**Positivas**

- El plan del mes sigue la estrategia real del autor y cambia cuando cambian las señales.
- Menos configuración: no hay que mantener objetivos por acción.

**Negativas / costos**

- El plan depende de tener un reporte reciente; sin él cae en partes iguales.
- Sin topes, el aporte se puede concentrar en pocas acciones. La concentración por sector y país sigue visible en Análisis.
- Se borran los objetivos guardados (la migración `20261009220000_drop_target_allocations` elimina la tabla).

**Reglas para el código**

- Los pesos de confianza y las reglas del reparto viven en `planDca` con sus tests; cambiar el criterio es cambiar este ADR.
- La señal por ticker sale de `getLatestSignals()` (tag `reports:<userId>`, que invalida el route del análisis al guardar un reporte).

## Referencias

- `lib/dca-planner.ts`, `lib/dca-planner.test.ts`, `app/(app)/plan/page.tsx`, `components/plan/dca-planner-client.tsx`, `app/actions/reports.ts` (`getLatestSignals`), `components/dashboard/analysis-tools.tsx`, `lib/setup-status.ts`.
