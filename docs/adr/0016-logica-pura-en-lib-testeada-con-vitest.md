# ADR-0016: Lógica pura en `lib/` testeada con Vitest

- **Estado:** Aceptado
- **Fecha:** 2026-03-08 (separación de capas); Vitest y CI el 2026-09-28 (registrado retrospectivamente el 2026-10-04)
- **Relacionados:** ADR-0002

## Contexto

El valor de la app está en sus cálculos: PPM, P&L, CAGR, drawdown, ganancia real vs impacto CCL, proyecciones de jubilación, plan DCA, parseo de los CSV de Cocos. Un error ahí no rompe la UI: muestra un número equivocado sobre plata real, sin que nadie lo note.

Hasta septiembre de 2026 no había tests ni CI. Los cálculos que vivían mezclados con consultas a Prisma o dentro de componentes eran difíciles de probar.

## Decisión

- **La lógica de dominio vive en `lib/` como funciones puras**, sin Prisma, sin HTTP y sin auth: `cocos-movements`, `number-parsing`, `inflation`, `dca-planner`, `projections`, `setup-status`, `report-normalizer`.
- **Excepción acotada:** los helpers de lectura `lib/portfolio-data.ts`, `lib/analysis-data.ts` y `lib/real-gains-data.ts` pueden usar Prisma (son lecturas transversales a varias páginas, no lógica de dominio).
- **Tests con Vitest**, en entorno `node`, como `*.test.ts` al lado del módulo (`@` apunta a la raíz). No hay tests de integración contra la base ni de UI.
- **CI en GitHub Actions** (`.github/workflows/ci.yml`): `npm install` → `prisma generate` → lint → test → build, con variables de entorno dummy (el build no consulta la base).

## Alternativas

- **Jest:** equivalente, pero con más configuración para ESM/TypeScript; Vitest funciona sin transpilar aparte.
- **Tests de integración con una base real:** más cobertura de las actions, pero requieren infraestructura (contenedor de Postgres en CI) que hoy no se justifica.
- **Sin tests:** el estado anterior.

## Consecuencias

**Positivas**

- Los cálculos críticos se prueban en milisegundos, sin base de datos.
- El mismo parser corre en el cliente y en el servidor (ADR-0012).

**Negativas / costos**

- Las Server Actions (validación, filtros por usuario, transacciones) no tienen tests: los errores de autorización no los detecta el CI.
- Los datos reales no se versionan: los tests usan datos sintéticos, y los tests contra exportaciones reales (`__fixtures__/`, ignorado) se saltean con `describe.skipIf` cuando el archivo no está.
**Reglas para el código**

- Un cálculo nuevo va en `lib/<modulo>.ts` como función pura, con su `<modulo>.test.ts`.
- No importar `lib/db.ts` desde un módulo de lógica pura; si hace falta leer datos, la action o el helper `*-data.ts` lee y le pasa los datos.
- Antes de commitear: `npm run lint && npm test && npm run build` (el mismo orden que el CI).
- Nunca versionar fixtures con datos reales de la cuenta; usar datos sintéticos con el mismo formato.

## Referencias

- `vitest.config.mts`, `.github/workflows/ci.yml`, `lib/*.test.ts`.
- `.cursor/rules.md` (File Structure). Commit `340b5d3`.
