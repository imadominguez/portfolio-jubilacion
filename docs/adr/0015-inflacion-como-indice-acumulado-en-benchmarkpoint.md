# ADR-0015: Inflación (IPC) como índice acumulado en `BenchmarkPoint`

- **Estado:** Aceptado
- **Fecha:** 2026-09-28 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0006

## Contexto

Con inflación alta, que el portfolio crezca en pesos no dice nada: la pregunta relevante es si le ganó a la inflación. Para comparar hace falta una serie de inflación en la misma forma que los benchmarks (base 100 desde el primer snapshot).

argentinadatos.com publica el **IPC como tasa mensual** (% del mes), no como índice, y **no tiene endpoint de CER**; publica la **UVA**, un índice diario que ajusta por CER. La app ya tenía `BenchmarkPoint` y `getBenchmarkPoints` (normalización a base 100) para S&P 500, Merval y NASDAQ.

## Decisión

- El IPC se **compone a índice acumulado** antes de guardarlo: `nivel_n = nivel_{n-1} × (1 + tasa_n / 100)`, con `buildCumulativeIndex` (`lib/inflation.ts`, puro y testeado), y se guarda en `BenchmarkPoint` con `benchmarkId: "inflacion"`.
- La UVA se usa como **proxy del CER** y se guarda directa con `benchmarkId: "cer"`.
- Se reutilizan la tabla y la lectura de benchmarks: `getIndexPoints` es un alias de `getBenchmarkPoints`.
- El **CAGR real** de `/performance` descuenta la inflación anualizada del período: `(1 + nominal) / (1 + inflación) − 1`.
- El gráfico usa escala logarítmica por defecto, porque con inflación alta la lineal aplasta la serie del portfolio.

## Alternativas

- **Tabla propia para índices macro:** más explícita, pero duplica el modelo y la lógica de normalización.
- **Guardar las tasas y componer al leer:** cada lectura repite el cálculo y la normalización a base 100 se complica.
- **Otra fuente para el CER (BCRA):** API menos amigable; la UVA de argentinadatos sigue al CER con suficiente precisión para comparar.

## Consecuencias

**Positivas**

- Cero código nuevo en la capa de lectura y en los gráficos: la inflación es "un benchmark más".
- Las fórmulas de inflación son puras y testeadas (`lib/inflation.test.ts`).

**Negativas / costos**

- `BenchmarkPoint` mezcla índices de mercado (valores reales) con un índice sintético (IPC compuesto): el `value` del IPC no es un dato publicado sino uno derivado.
- El IPC se publica con un mes de rezago, así que el último tramo de la comparación queda incompleto.

**Reglas para el código**

- Una serie macro nueva que llega como tasa se compone con `buildCumulativeIndex` antes de guardar; una que ya es índice se guarda directa.
- Registrar el id nuevo en `lib/benchmarks-config.ts`.

## Referencias

- `lib/inflation.ts`, `app/actions/indices.ts`, `lib/benchmarks-config.ts`, `components/performance/inflation-chart.tsx`.
- Commit `7a350d9`. [`logica-financiera.md`](../logica-financiera.md#inflación-y-rendimiento-real-libinflationts-appactionsindicests).
