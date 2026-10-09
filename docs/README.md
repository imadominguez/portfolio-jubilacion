# Documentación — Portfolio Jubilación

Documentación técnica y funcional completa de la aplicación **Portfolio Jubilación**, un dashboard personal para el seguimiento de un portafolio de inversión a largo plazo compuesto por **CEDEARs** operados en **Cocos Capital**, con planificación de retiro integrada.

> Esta carpeta complementa y amplía la documentación ya existente:
> - [`flujo-de-uso.md`](./flujo-de-uso.md) — flujo operativo mensual y guía de importación.
> - [`datos-del-portfolio.md`](./datos-del-portfolio.md) — qué métrica muestra cada pantalla.

---

## ¿Qué es la app?

Un tracker privado (multiusuario con autenticación: cada usuario ve solo sus datos; el registro público está cerrado) que:

1. Importa **snapshots inmutables** del portafolio desde CSV exportados de Cocos Capital.
2. Registra **transacciones** (compras/ventas) y **dividendos** para calcular PPM y P&L, y muestra los **gastos del mes** a partir de los pagos de la cuenta, con categorías manuales, y el **flujo de caja** mensual con la tasa de ahorro.
3. Mide **performance** histórica sin contar aportes (TIR, TWR, drawdown) y compara contra benchmarks e inflación.
4. Descompone la **ganancia real en USD** separando la apreciación de la acción del impacto del CCL.
5. Proyecta la **jubilación** (capital necesario, proyección y Monte Carlo).
6. Analiza **concentración** por sector/país/industria y permite **rebalanceo** contra objetivos.
7. Genera el **plan DCA determinista** del mes (qué comprar y cuánto) sin depender de la IA.
8. Junta los datos para la **declaración anual**: tenencia al cierre, resultado de las ventas y dividendos cobrados (`/impuestos`).
9. Manda **alertas por mail**: caídas fuertes de tus acciones (con titulares) y recordatorio de carga mensual.
10. Genera un **reporte de oportunidades con IA**: revisa precio y titulares de noticias de cada acción y dice si es momento de comprar, mantener o vender.

---

## Índice de documentos

| Documento | Contenido |
|---|---|
| [arquitectura.md](./arquitectura.md) | Stack, estructura de carpetas, capas, autenticación, roles, variables de entorno. |
| [modelo-de-datos.md](./modelo-de-datos.md) | Todos los modelos Prisma, enums, relaciones, tablas, migraciones y seed. |
| [modulos.md](./modulos.md) | Descripción detallada de cada ruta/página de `app/(app)/`. |
| [logica-financiera.md](./logica-financiera.md) | Fórmulas: PPM, P&L, allocation, rendimiento sin aportes (TIR, TWR), drawdown, ganancia real, jubilación, señales del reporte de oportunidades, parsing CSV. |
| [server-actions.md](./server-actions.md) | Referencia de todas las Server Actions de `app/actions/`. |
| [api-y-exportacion.md](./api-y-exportacion.md) | API routes (análisis IA, export PDF/CSV/HTML) y componentes de exportación. |
| [integraciones.md](./integraciones.md) | Cocos Capital, dolarapi.com, argentinadatos.com, Yahoo Finance, Anthropic. |
| [componentes.md](./componentes.md) | Componentes de UI por dominio, layout y sistema de onboarding/tours. |
| [desarrollo.md](./desarrollo.md) | Setup local, scripts, migraciones, convenciones de código y deploy. |
| [adr/](./adr/README.md) | **Architecture Decision Records**: por qué se tomó cada decisión de arquitectura, con sus alternativas y consecuencias. |
| [flujo-de-uso.md](./flujo-de-uso.md) | Flujo operativo mensual y guía de importación. |
| [datos-del-portfolio.md](./datos-del-portfolio.md) | Qué métrica muestra cada pantalla y cómo se calcula. |
| [movimientos/analisis-csv-movimientos.md](./movimientos/analisis-csv-movimientos.md) | Análisis del formato del CSV de movimientos de Cocos. |

---

## Resumen técnico

- **Framework:** Next.js 16 (App Router, React 19) + TypeScript estricto.
- **UI:** shadcn/ui (`radix-nova`), Tailwind CSS v4, Recharts, Lucide, Sonner, next-themes, nextstepjs.
- **Auth:** Better Auth (email + password) con campo `role` (`USER` / `ADMIN`).
- **Base de datos:** PostgreSQL + Prisma 7 (driver adapter `@prisma/adapter-pg`; cliente generado en `app/generated/prisma`).
- **Mutaciones:** Server Actions (`app/actions/`). API routes solo para binarios (PDF/CSV/HTML) y el análisis con IA.
- **IA:** Anthropic Claude (`claude-sonnet-5-5`, configurable con `ANTHROPIC_MODEL`) con el SDK oficial y structured outputs; la app le prepara precios y noticias ([ADR-0018](./adr/0018-reporte-de-oportunidades-con-datos-preparados-por-la-app.md)).
- **Exportación:** `@react-pdf/renderer` (PDF server-side), CSV y HTML imprimible.
- **Fuentes externas:** Cocos Capital (CSV), dolarapi.com (CCL actual), argentinadatos.com (CCL histórico), Yahoo Finance (precios actuales/históricos y titulares de noticias).

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
7. **Aislamiento por usuario.** Los datos del portafolio llevan `userId` y toda lectura/borrado filtra por el usuario de la sesión; los datos de mercado (CCL, precios, benchmarks, catálogo de assets) son globales.

Cada uno de estos principios tiene su ADR con el contexto y las alternativas descartadas: ver [`adr/`](./adr/README.md).
