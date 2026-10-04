# ADR-0004: Snapshots inmutables con el CCL congelado

- **Estado:** Aceptado
- **Fecha:** 2026-03-08 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0005, ADR-0006

## Contexto

Cocos Capital no ofrece una API: el estado de la cartera se obtiene exportando un CSV de tenencia (`portfolio_report_AAAAMMDD.csv`) que refleja **un momento**. Las métricas centrales de la app (evolución, CAGR, drawdown, rendimiento en USD) comparan esos momentos entre sí.

En Argentina el valor en USD depende del CCL, que cambia todos los días y a veces mucho. Si el valor en USD de un snapshot viejo se recalculara con el CCL de hoy, o se corrigieran sus posiciones con datos posteriores, toda la serie histórica cambiaría retroactivamente y las métricas dejarían de reflejar lo que efectivamente pasó.

## Decisión

- Un `PortfolioSnapshot` es un **registro inmutable**: una vez importado no se edita. Solo se puede borrar (y reimportar).
- **Una fecha, un snapshot por usuario:** `@@unique([userId, snapshotDate])`. `importSnapshot` rechaza una fecha existente.
- El **CCL se congela en el snapshot** (`PortfolioSnapshot.ccl`) al importar, junto con `totalValueUsd = totalValueArs / ccl`. Toda conversión ARS↔USD de datos históricos usa el CCL de esa fecha, nunca el actual.
- `Position.allocationPct` se **guarda desnormalizado** (fracción 0–1) aunque se pueda recalcular, para que el snapshot reproduzca exactamente su estado original.
- Si un CSV tiene posiciones en USD, el CCL es obligatorio para importarlo.

## Alternativas

- **Guardar solo las transacciones y reconstruir el estado:** depende de que el historial de movimientos esté completo y no captura precios de mercado de cada fecha. Las transacciones existen (ADR-0012), pero como complemento.
- **Snapshots editables:** simplifica corregir errores, pero rompe la reproducibilidad de las métricas. Para corregir se borra y se reimporta.
- **Calcular el USD al vuelo con el CCL del día del snapshot desde `ExchangeRate`:** introduce una dependencia en una tabla global que puede actualizarse o tener huecos; congelar el valor en el snapshot elimina esa ambigüedad.

## Consecuencias

**Positivas**

- Las series históricas y los KPIs son estables y auditables.
- El valor en USD de cada snapshot no depende de que `ExchangeRate` tenga datos para esa fecha.

**Negativas / costos**

- Un error en un CSV importado se corrige borrando y reimportando el snapshot.
- Hay datos desnormalizados (`allocationPct`, `totalValueUsd`) que no se recalculan si cambia la lógica.

**Reglas para el código**

- Nunca hacer `update` sobre `PortfolioSnapshot` ni sobre sus `Position`.
- Nunca actualizar el `ccl` de un snapshot ni recalcular sus totales con datos posteriores.
- Para el USD de un snapshot, usar `snapshot.ccl` / `snapshot.totalValueUsd`, no el CCL actual.

## Referencias

- `app/actions/snapshots.ts` (`importSnapshot`, `computeTotalsAndAllocations`).
- `.cursor/rules.md` (Financial Data Rules, CCL Handling).
- [`logica-financiera.md`](../logica-financiera.md#allocation-de-un-snapshot).
