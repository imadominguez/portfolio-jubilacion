# Módulos y rutas

Descripción de cada página en `app/(app)/`. El layout común (`app/(app)/layout.tsx`) monta `OnboardingProvider → TooltipProvider → SidebarProvider → AppSidebar + SidebarInset`. Todas las rutas requieren sesión (middleware); las marcadas **(ADMIN)** redirigen a `/` si el usuario no es admin.

Metadata raíz (`app/layout.tsx`): `title` por defecto `"Portfolio Jubilación"`, template `"%s | Portfolio Jubilación"`.

---

## `/` — Dashboard

- **Archivo:** `app/(app)/page.tsx` (server component async, ~560 líneas).
- **Propósito:** pantalla principal con el estado del **snapshot más reciente**.
- **Datos (en `Promise.all`):**
  - `getLatestSnapshot()` — `lib/portfolio-data.ts`
  - `calculatePPM()` — `app/actions/transactions.ts`
  - `getMarketPrices()` — `app/actions/market-prices.ts`
  - `getAllSnapshotPoints()` — `lib/portfolio-data.ts`
  - `getTotalDividendsUsd()` — `app/actions/dividends.ts`
  - `getMilestones()` — `app/actions/milestones.ts`
  - `calculateRealGains()` — `lib/real-gains-data.ts`
  - `getRetirementSettings()` — `app/actions/retirement.ts`
  - `getRebalanceData()` — `app/actions/rebalance.ts`
  - `getConcentrationData()` — `lib/analysis-data.ts`
  - `getPreviousSnapshotFull(snapshot.snapshotDate)` (condicional)
  - `calculateRetirementGoal({ ..., annualReturnRate: 0.1 })` — `lib/projections.ts`
- **KPIs:** valor total ARS/USD, rendimiento vs snapshot anterior, P&L no realizado (precio snapshot vs PPM en ARS), dividendos USD, posiciones activas, CCL.
- **Componentes:** `SiteHeader` (título "Dashboard", acción `<ImportButton/>`), `DashboardHero`, tira de KPIs, `PortfolioChartWidget`, accesos rápidos a `/real-gains`, `/retirement`, `/rebalance`, `/analysis`, `PerformersPanel` (si hay previo), `AllocationPanel`, `HoldingsTable` (con `ppmData` y `marketPrices`), `MilestoneWidget`, o `EmptyDashboard` si no hay snapshot.
- **Estado vacío:** `EmptyDashboard` con CTA de importación.
- **loading.tsx:** sí (skeletons).

---

## `/datos` — Centro de Datos

- **Archivo:** `app/(app)/datos/page.tsx` (server component async).
- **Propósito:** hub único para importar y mantener actualizados todos los datos. Reúne lo que antes estaba disperso.
- **Datos (en `Promise.all`):** `getSetupStatus()`, `getDataReadiness()`, `getMarketPrices()`, `getAllExchangeRates()`, `getIndexPoints("inflacion")`, `getIndexPoints("cer")`.
- **Muestra:** `SetupChecklist` (read-only) + tarjetas de import (snapshot, movimientos), mantenimiento (CCL, precios, inflación/CER), históricos (`RealGainsWizard`) y accesos a Rebalanceo / Jubilación / Hitos / Benchmarks.
- **Componentes:** `SiteHeader`, `SetupChecklist`, `ImportButton`, `ImportMovimientosButton`, `CclUpdateButton`, `MarketPricesButton`, `IndicesUpdateButton`, `RealGainsWizard`.

---

## `/portfolio` — Reporte mensual con IA **(ADMIN)**

- **Archivo:** `app/(app)/portfolio/page.tsx` (server component **síncrono**, 16 líneas).
- **Propósito:** analizar la tenencia en PDF de Cocos con Claude y mostrar el historial de reportes.
- **Datos:** no hace fetch; el cliente llama a `POST /api/analyze-portfolio` (`PortfolioAnalyzer`) y a las actions `listReports()` / `getReport(id)` (`ReportHistorial`).
- **Componentes:** `PortfolioAnalyzer`, `ReportHistorial`.
- **Metadata:** `title: "Reporte mensual | Portafolio de jubilación"`.
- **Nota:** no tiene `loading.tsx` ni `SiteHeader`.

---

## `/performance` — Performance

- **Archivo:** `app/(app)/performance/page.tsx` (server component async).
- **Datos:** `getAllSnapshotPoints()`, `getBenchmarkPoints(id, fromDate)` para `sp500`, `merval`, `nasdaq` y `getIndexPoints(id, fromDate)` para `inflacion` y `cer`, desde la fecha del primer snapshot.
- **KPIs:** rendimiento del año (base = último snapshot del año anterior o el primero del año), **CAGR**, **CAGR real** (nominal deflactado por inflación), **máx. drawdown**, cantidad de snapshots.
- **Componentes:** `SiteHeader` (+`ImportButton`), `PerformanceChart` (toggle ARS/USD), `BenchmarkOverlayChart` (normaliza a base 100 y carga benchmarks on-demand), `InflationChart` (portfolio vs IPC/CER, escala log por defecto, carga on-demand).
- **Estado vacío:** mensaje con `TrendingUp` + `ImportButton`.

---

## `/ccl` — Historial CCL

- **Archivo:** `app/(app)/ccl/page.tsx` (server component async).
- **Datos:** `getAllExchangeRates()` (global) y `getAllSnapshotPoints()`.
- **KPIs:** CCL actual, variación 1 mes, YTD y 1 año (buscando el registro más cercano hacia atrás). Colores invertidos: subir el CCL se muestra como algo negativo para el portafolio en ARS.
- **Componentes:** `SiteHeader` (+`ImportButton`), `CCLChart` (doble eje Y: CCL y valor del portafolio en USD; ~12 ticks en X) y una tabla con los últimos 30 registros.
- **Estado vacío:** sugiere actualizar el CCL desde Assets.

---

## `/snapshots` — Listado de snapshots

- **Archivo:** `app/(app)/snapshots/page.tsx` (server component async).
- **Datos:** `getAllSnapshotPoints()` (se invierte para mostrar el más reciente primero).
- **Muestra:** fecha, valor ARS, valor USD, CCL, cantidad de posiciones y variación % vs anterior; enlace a `/snapshots/[id]`.
- **Componentes:** `SiteHeader` (+`ImportButton`), `Badge`, `Separator`, links.

---

## `/snapshots/[id]` — Detalle de snapshot

- **Archivo:** `app/(app)/snapshots/[id]/page.tsx` (server component async, `params: Promise<{ id }>`).
- **Datos:** **acceso directo a Prisma** `db.portfolioSnapshot.findUnique({ where: { id }, include: { positions: { orderBy: { positionValue: "desc" } } } })`. No aplica filtro por usuario.
- **Muestra:** KPIs (ARS, USD, CCL, posiciones), `AllocationPanel` y `HoldingsTable` (sin PPM ni precios en vivo).
- **Exportación:** `ExportButtons snapshotId={id}` → PDF, imprimir/vista previa, CSV.
- **Metadata:** `generateMetadata` dinámico (`Snapshot <fecha>` en es-AR).
- **Errores:** `notFound()` si el id no existe.

---

## `/analysis` — Concentración

- **Archivo:** `app/(app)/analysis/page.tsx` (server component async).
- **Datos:** `getConcentrationData()` — usa el snapshot más reciente y cruza contra `Asset`.
- **Muestra:** donuts por **sector**, **país** e **industria** (`ConcentrationCharts`) y barras tipo Top 10; avisa el monto "sin clasificar" e invita a completar Assets.
- **Estado vacío:** icono `BarChart3`.

---

## `/rebalance` — Rebalanceo

- **Archivo:** `app/(app)/rebalance/page.tsx` (server component async).
- **Datos:** `getRebalanceData()` y `getTargetAllocations()` (ambas con `requireAuth`). `totalPct` = suma de objetivos.
- **Regla:** `deviation = currentPct − targetPct`; `BUY` si `< −1`, `SELL` si `> 1`, `HOLD` en el resto (umbral ±1 punto porcentual).
- **Componentes:** `SiteHeader`, `RebalanceClient` (tabla ordenable, alta/baja de objetivos, badge de total con alerta si se aleja de 100%).
- **Estado vacío:** icono `Scale`.

---

## `/plan` — Plan DCA

- **Archivo:** `app/(app)/plan/page.tsx` (server component async).
- **Propósito:** calcular de forma **determinista** (sin IA) cómo repartir el aporte mensual entre las posiciones del objetivo, priorizando las infraponderadas.
- **Datos:** `getLatestSnapshot()`, `getTargetAllocations()`, `getMarketPrices()`.
- **Lógica:** `planDca()` de `lib/dca-planner.ts` (pura y testeada) — water-filling sobre el *gap* de cada ticker (`targetPct% · valorCartera − valorActual`), sin comprar posiciones que ya alcanzaron su objetivo. Estima CEDEARs con el precio del subyacente y el CCL.
- **Componentes:** `SiteHeader`, `DcaPlannerClient` (input de aporte, tabla por ticker con desvío, monto a comprar, CEDEARs estimados y peso resultante).
- **Estados vacíos:** sin snapshot (CTA a `/datos`) y sin objetivos (CTA a `/rebalance`).
- **loading.tsx:** sí.

---

## `/retirement` — Planificación de jubilación

- **Archivo:** `app/(app)/retirement/page.tsx` (server component async).
- **Datos:** `getRetirementSettings()`, `getAllSnapshotPoints()`; `currentPortfolioUsd` del último snapshot con `totalValueUsd`; `historicalCagr` calculado localmente (requiere ≥2 snapshots con USD).
- **Componentes:** `SiteHeader`, `RetirementClient` (tabs Calculadora, Proyección, Monte Carlo).
- **Cálculos:** `calculateRetirementGoal`, `buildProjectionCurve`, `runMonteCarlo` (500 simulaciones) de `lib/projections.ts`, memoizados. Tasa anual = `min(historicalCagr/100, 0.30)` o `0.07` por defecto.

---

## `/transactions` — Transacciones

- **Archivo:** `app/(app)/transactions/page.tsx` (server component async).
- **Datos (`Promise.all`):** `getAllTransactions()`, `calculatePPM()`, `getRealizedPnl()`, `getAllDividends()`, `getMovements()`.
- **Muestra:** tabs de Transacciones, PPM, P&L realizado, Dividendos y **Movimientos** (con sub-vista **Fondos FCI**); exportar transacciones a CSV; importar movimientos de Cocos; formularios de transacción y dividendo.
- **Componentes:** `SiteHeader` (acciones `CsvExportButton href="/api/export/transactions"`, `ImportMovimientosButton`, `DividendForm`, `TransactionForm`), `TransactionsClient`.

---

## `/real-gains` — Ganancia Real en USD

- **Archivo:** `app/(app)/real-gains/page.tsx` (server component async, ~636 líneas con subcomponentes locales `KpiCard`, `BreakdownBar`, `PositionsTable`, `MethodologyNote`).
- **Datos:** `getDataReadiness()` y `calculateRealGains()`.
- **Muestra:** desglose de la ganancia en USD (valor actual vs costo) separando **apreciación del subyacente** e **impacto CCL**; tabla por posición con cobertura de datos; nota metodológica. Sólo incluye instrumentos con subyacente (CEDEARs); bonos y acciones locales quedan excluidos.
- **Componentes:** `SiteHeader` (acción `RealGainsUpdateButton` si hay datos), `RealGainsWizard` (2 pasos para poblar CCL histórico y precios históricos de subyacentes).

---

## `/assets` — Catálogo de CEDEARs **(ADMIN)**

- **Archivo:** `app/(app)/assets/page.tsx` (server component async).
- **Datos:** **acceso directo a Prisma** `db.asset.findMany({ orderBy: { ticker: "asc" } })`; serializa `cedearRatio` a `Number`.
- **Muestra:** tabla con ticker, ratio, subyacente, sector/industria/país y descripción; alta/edición/eliminación vía diálogo.
- **Acciones del header:** `CclUpdateButton`, `MarketPricesButton`, `ImportButton`.
- **Componentes:** `SiteHeader`, `AssetsTableClient`.

---

## `/strategy` — Estrategia de inversión **(ADMIN)**

- **Archivo:** `app/(app)/strategy/page.tsx` (server component async).
- **Datos:** `getActiveStrategy()` y `getStrategyHistory()`.
- **Propósito:** editar el **system prompt** versionado que usa el análisis con Claude. Cada cambio crea una versión nueva inmutable; se puede restaurar una anterior (pasa a `isActive`).
- **Componentes:** `SiteHeader`, `StrategyEditor`.

---

## `/settings` — Configuración **(ADMIN)**

- **Archivo:** `app/(app)/settings/page.tsx` (server component async).
- **Datos:** `getMilestones()` (crea hitos por defecto si no hay) y `getLatestSnapshot()`.
- **Propósito:** crear/eliminar **hitos** de valor en USD; se verifican automáticamente al importar un snapshot y se marca `reachedAt`.
- **Componentes:** `SiteHeader`, `MilestonesClient`.

---

## `/guia` — Guía Cocos

- **Archivo:** `app/(app)/guia/page.tsx` (server component **síncrono**, delega a cliente).
- **Datos:** ninguna.
- **Propósito:** explicar con capturas cómo descargar el CSV de **Portfolio** (snapshots) y de **Actividad** (movimientos) desde Cocos. Es destino de anclas (`/guia#snapshots`, `/guia#transacciones`) y contiene los targets del tour de onboarding.
- **Componentes:** `SiteHeader`, `CocosGuide` (+ `RestartTourButton`).

---

## Autenticación — `(auth)`

| Ruta | Archivo | Comportamiento |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` | Client component; `signIn.email({ email, password })`; error genérico "Email o contraseña incorrectos."; éxito → `router.push("/")` + `refresh()`. |
| `/register` | `app/(auth)/register/page.tsx` | Client component; valida que las contraseñas coincidan y longitud ≥ 8; `signUp.email({ name, email, password })`; error 422 → "Ya existe una cuenta con ese email." El `role` nunca se envía (siempre `USER`). |

Ambas redirigen a `/` si ya hay sesión (middleware).

---

## Resumen

| Ruta | Server async | Fuente principal | ADMIN | loading.tsx |
|---|---|---|---|---|
| `/` | Sí | `lib/*-data` + actions | No | Sí |
| `/datos` | Sí | setup + readiness + precios/CCL | No | No |
| `/portfolio` | No | API IA + actions reports | **Sí** | No |
| `/performance` | Sí | snapshots + benchmarks | No | Sí |
| `/ccl` | Sí | exchange rates + snapshots | No | Sí |
| `/snapshots` | Sí | snapshots | No | Sí |
| `/snapshots/[id]` | Sí | Prisma directo | No | Sí |
| `/analysis` | Sí | concentration | No | Sí |
| `/rebalance` | Sí | actions rebalance | No | Sí |
| `/plan` | Sí | snapshot + objetivos + precios | No | Sí |
| `/retirement` | Sí | settings + snapshots | No | Sí |
| `/transactions` | Sí | actions transactions/dividends | No | Sí |
| `/real-gains` | Sí | real gains data | No | Sí |
| `/assets` | Sí | Prisma directo | **Sí** | Sí |
| `/strategy` | Sí | actions strategy | **Sí** | No |
| `/settings` | Sí | milestones + snapshot | **Sí** | Sí |
| `/guia` | No | — | No | No |
| `/login`, `/register` | No | Better Auth client | No | No |

> Único redirect/error propio de página: `notFound()` en `/snapshots/[id]`. El resto de la protección es del middleware.
