# Documentación — Portfolio Jubilación

Documentación técnica y funcional completa de la aplicación **Portfolio Jubilación**, un dashboard personal para el seguimiento de un portafolio de inversión a largo plazo compuesto por **CEDEARs** operados en **Cocos Capital**, con planificación de retiro integrada.

> Esta carpeta complementa y amplía la documentación ya existente:
> - [`flujo-de-uso.md`](./flujo-de-uso.md) — flujo operativo mensual y guía de importación.
> - [`datos-del-portfolio.md`](./datos-del-portfolio.md) — qué métrica muestra cada pantalla.

---

## ¿Qué es la app?

Un tracker privado (single-user con autenticación) que:

1. Importa **snapshots inmutables** del portafolio desde CSV exportados de Cocos Capital.
2. Registra **transacciones** (compras/ventas) y **dividendos** para calcular PPM y P&L.
3. Mide **performance** histórica (CAGR, drawdown) y compara contra benchmarks.
4. Descompone la **ganancia real en USD** separando la apreciación de la acción del impacto del CCL.
5. Proyecta la **jubilación** (capital necesario, proyección y Monte Carlo).
6. Analiza **concentración** por sector/país/industria y permite **rebalanceo** contra objetivos.
7. Genera el **plan DCA determinista** del mes (qué comprar y cuánto) sin depender de la IA.
8. Genera **reportes mensuales con IA** (Claude + web search) a partir del PDF de tenencia de Cocos.

---

## Índice de documentos

| Documento | Contenido |
|---|---|
| [arquitectura.md](./arquitectura.md) | Stack, estructura de carpetas, capas, autenticación, roles, variables de entorno. |
| [modelo-de-datos.md](./modelo-de-datos.md) | Todos los modelos Prisma, enums, relaciones, tablas, migraciones y seed. |
| [modulos.md](./modulos.md) | Descripción detallada de cada ruta/página de `app/(app)/`. |
| [logica-financiera.md](./logica-financiera.md) | Fórmulas: PPM, P&L, allocation, CAGR, drawdown, ganancia real, jubilación, parsing CSV. |
| [server-actions.md](./server-actions.md) | Referencia de todas las Server Actions de `app/actions/`. |
| [api-y-exportacion.md](./api-y-exportacion.md) | API routes (análisis IA, export PDF/CSV/HTML) y componentes de exportación. |
| [integraciones.md](./integraciones.md) | Cocos Capital, dolarapi.com, argentinadatos.com, Yahoo Finance, Anthropic. |
| [componentes.md](./componentes.md) | Componentes de UI por dominio, layout y sistema de onboarding/tours. |
| [desarrollo.md](./desarrollo.md) | Setup local, scripts, migraciones, convenciones de código y deploy. |

---

## Resumen técnico

- **Framework:** Next.js 16 (App Router, React 19) + TypeScript estricto.
- **UI:** shadcn/ui (`radix-nova`), Tailwind CSS v4, Recharts, Lucide, Sonner, next-themes, nextstepjs.
- **Auth:** Better Auth (email + password) con campo `role` (`USER` / `ADMIN`).
- **Base de datos:** PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`; cliente generado en `app/generated/prisma`).
- **Mutaciones:** Server Actions (`app/actions/`). API routes solo para binarios (PDF/CSV/HTML) y el análisis con IA.
- **IA:** Anthropic Claude (`claude-sonnet-5`, configurable con `ANTHROPIC_MODEL`) con tool de web search.
- **Exportación:** `@react-pdf/renderer` (PDF server-side), CSV y HTML imprimible.
- **Fuentes externas:** Cocos Capital (CSV), dolarapi.com (CCL actual), argentinadatos.com (CCL histórico), Yahoo Finance (precios actuales/históricos).

### Conceptos clave

| Término | Significado |
|---|---|
| **CEDEAR** | Certificado que representa una fracción de una acción extranjera cotizada en ARS. |
| **CCL** | Contado con Liquidación — tipo de cambio implícito ARS/USD. |
| **Snapshot** | Foto inmutable del portafolio en una fecha. |
| **PPM** | Precio Promedio Ponderado de compra. |
| **Ratio CEDEAR** | Cantidad de CEDEARs que equivalen a 1 acción subyacente. |
| **Underlying ticker** | Símbolo de la acción en NYSE/NASDAQ (para precios de Yahoo). |

---

## Principios de diseño

1. **Los snapshots son inmutables.** Una vez importados no se modifican; el historial se reconstruye con fidelidad.
2. **Una fecha, un snapshot.** Restricción única `(userId, snapshotDate)`.
3. **Separación de monedas.** Toda conversión ARS↔USD usa el CCL registrado en la fecha correspondiente, no el actual.
4. **Decimal para dinero.** Todos los valores financieros se guardan como `Decimal` en Prisma y se convierten con `Number(...)` al exponerlos.
5. **Datos externos cacheados.** Yahoo Finance y CCL se persisten en DB para no depender de llamadas repetidas.
6. **Lógica separada de la UI.** Cálculos puros en `lib/`, accesos a DB en `app/actions/` y en los helpers `lib/*-data.ts`.
