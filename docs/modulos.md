# Módulos y rutas

Descripción de cada página en `app/(app)/`. El layout común (`app/(app)/layout.tsx`, síncrono: entra al static shell) monta `OnboardingProvider → TooltipProvider → SidebarProvider → AppSidebar + SidebarInset`; el grupo admin del sidebar se resuelve detrás de `<Suspense>`. Todas las rutas requieren sesión (proxy, `proxy.ts`); las marcadas **(ADMIN)** redirigen a `/` si el usuario no es admin. Todas tienen `loading.tsx` y comparten `error.tsx` / `not-found.tsx` del grupo `(app)`.

**Cache Components (ADR-0017), patrón de todas las páginas:** la página es síncrona y entra al static shell con su `SiteHeader` (y, si la tiene, la explicación estática); las lecturas de datos van en un componente async dentro de `<Suspense>`, con un skeleton compartido con su `loading.tsx` (`components/<dominio>/*-skeleton.tsx`). Las lecturas están cacheadas con `'use cache'` y un tag por dominio ([server-actions.md](./server-actions.md)). Ninguna ruta usa `instant = false`.

Metadata raíz (`app/layout.tsx`): `title` por defecto `"Portfolio Jubilación"`, template `"%s | Portfolio Jubilación"`.

---

## `/` — Dashboard

- **Archivo:** `app/(app)/(dashboard)/page.tsx`. Vive en el grupo `(dashboard)` para que su `loading.tsx` aplique solo a `/`: en `app/(app)/` envolvía a todas las rutas y su skeleton quedaba en el static shell de cada una.
- **Propósito:** pantalla principal con el estado del **snapshot más reciente**.
- **Datos (dentro de `<Suspense>`, en dos fases):**
  1. `Promise.all([getLatestSnapshot(), getSetupStatus()])`. Si no hay snapshot, corta acá y muestra `SetupPanel` + `EmptyDashboard` sin consultar el resto.
  2. Con snapshot, en `Promise.all`:
  - `calculatePPM()` — `app/actions/transactions.ts`
  - `getMarketPrices()` — `app/actions/market-prices.ts`
  - `getAllSnapshotPoints()` — `lib/portfolio-data.ts`
  - `getTotalDividendsUsd()` — `app/actions/dividends.ts`
  - `getMilestones()` — `app/actions/milestones.ts`
  - `calculateRealGains()` — `lib/real-gains-data.ts`
  - `getRetirementSettings()` — `app/actions/retirement.ts`
  - `getRebalanceData()` — `app/actions/rebalance.ts`
  - `getConcentrationData()` — `lib/analysis-data.ts`
  - `getPreviousSnapshotFull(snapshot.snapshotDate)`
  - `getHoldingsFlows()` — `lib/portfolio-data.ts`
  - Luego, en el servidor: `calculateRetirementGoal({ ..., annualReturnRate: 0.1 })` — `lib/projections.ts`
- **KPIs:** valor total ARS/USD, rendimiento vs snapshot anterior sin aportes (`modifiedDietz` y `netContributions` de `lib/flow-returns.ts`: "—" sin base positiva), P&L no realizado (precio snapshot vs PPM en ARS), dividendos USD, posiciones activas, CCL.
- **Componentes:** `SiteHeader` (título "Dashboard", acción `<ImportButton/>`), `SetupPanel` (wizard + checklist de puesta en marcha), `DashboardHero`, `DashboardKpiStrip`, `PortfolioChartWidget`, `AnalysisTools` (tarjetas resumen de Ganancia Real, Jubilación, Rebalanceo y Concentración con link a cada módulo), `PerformersPanel` (si hay previo), `AllocationPanel`, `HoldingsTable` (con `ppmData` y `marketPrices`), `MilestoneWidget`.
- **Estado vacío:** `SetupPanel` + `EmptyDashboard` con CTA de importación.

---

## `/datos` — Centro de Datos

- **Archivo:** `app/(app)/datos/page.tsx`.
- **Propósito:** hub único para importar y mantener actualizados todos los datos.
- **Shell:** casi toda la página es estática y entra al static shell (títulos, descripciones y botones de las cuatro secciones). Solo se streamea, cada parte en su `<Suspense>`: el checklist (`getSetupStatus()`), el dato de cada tarjeta de mantenimiento (último CCL con `getAllExchangeRates()`, cantidad de precios con `getMarketPrices()` y `getSession()`, puntos de IPC/CER con `getIndexPoints()`), la sección de históricos (`getDataReadiness()`) y el link de Hitos (solo ADMIN, `getSession()`).
- **Muestra:** checklist (`SetupChecklist` si está completo, si no `SetupPanel`) + tarjetas de import (snapshot, movimientos), mantenimiento (CCL, precios, inflación/CER), históricos (`RealGainsWizard`) y accesos a Rebalanceo / Jubilación / Hitos / Benchmarks.
- **Componentes:** `SiteHeader`, `SetupChecklist`, `SetupPanel`, `ImportButton`, `ImportMovimientosButton`, `CclUpdateButton`, `MarketPricesButton`, `IndicesUpdateButton`, `RealGainsWizard`.

---

## `/portfolio` — Oportunidades con IA **(ADMIN)**

- **Archivo:** `app/(app)/portfolio/page.tsx` (síncrona, sin lecturas en el servidor: entra entera al static shell).
- **Propósito:** revisar cada acción del último snapshot (precio y titulares de noticias) y decir si es oportunidad de **compra**, **mantener** o **venta** ([ADR-0018](./adr/0018-reporte-de-oportunidades-con-datos-preparados-por-la-app.md)). No habla de porcentajes de tenencia: el reparto del aporte está en `/plan`.
- **Datos:** no hace fetch en el servidor; el cliente llama a `POST /api/analyze-portfolio` (`OpportunityAnalyzer`) y a las actions `listReports()` / `getReport(id)` (`ReportHistorial`).
- **Componentes:** `OpportunityAnalyzer`, `OpportunityReportDisplay`, `ReportHistorial` (muestra los reportes anteriores con `ReporteDisplay`, de `legacy-report.tsx`).
- **Metadata:** `title: "Oportunidades"`.
- **Nota:** no usa `SiteHeader` (excepción a la convención de UI). Requiere un snapshot importado; las acciones sin subyacente en Yahoo quedan fuera del análisis.

---

## `/performance` — Performance

- **Archivo:** `app/(app)/performance/page.tsx`.
- **Moneda:** `searchParams.moneda` (`usd` → dólares; si no, pesos), leído dentro de `<Suspense>`. Un selector Pesos / Dólares arriba de los KPIs cambia el link.
- **Datos:** `getAllSnapshotPoints()`, `getHoldingsFlows()`, `getBenchmarkPoints(id, fromDate)` para `sp500`, `merval`, `nasdaq` y `getIndexPoints(id, fromDate)` para `inflacion` y `cer`. Las métricas y los gráficos normalizados usan la serie desde el **primer snapshot con valor** (`performanceSeries`, [logica-financiera.md](./logica-financiera.md)); de ahí sale también `fromDate`.
- **KPIs** (`returnSummary`, `lib/flow-returns.ts`, ADR-0019), todos sin contar aportes y en la moneda elegida: rendimiento del año (TWR; base = último snapshot del año anterior o el primero del año) con la ganancia, **TIR anual**, **máx. drawdown** sobre el índice TWR y un tercer KPI que depende de la moneda: en pesos, **TIR real** (deflactada por inflación); en dólares, **vs S&P 500** (TWR anual del portfolio menos la variación anual del S&P 500 en el mismo período, en puntos). Sin base positiva muestran "—". Si el último movimiento importado es anterior al último snapshot, un aviso pide importar el CSV de Actividad.
- **Componentes:** `SiteHeader`, `PerformanceChart` (toggle ARS/USD, arranca en la moneda elegida), `BenchmarkOverlayChart` (índice TWR del portfolio en la moneda elegida vs benchmarks, carga on-demand), `InflationChart` (siempre en pesos: índice TWR en ARS vs IPC/CER, escala log por defecto, carga on-demand) y la tabla de registros con el valor y el rendimiento de cada período en la moneda elegida.
- **Estado vacío:** mensaje con `TrendingUp` + `ImportButton`.

---

## `/ccl` — Historial CCL

- **Archivo:** `app/(app)/ccl/page.tsx`.
- **Datos:** `getAllExchangeRates()` (global, tag `ccl`) y `getAllSnapshotPoints()`.
- **KPIs:** CCL actual, variación 1 mes, YTD y 1 año (buscando el registro más cercano hacia atrás). Colores invertidos: subir el CCL se muestra como algo negativo para el portafolio en ARS.
- **Componentes:** `SiteHeader` (acción `CclUpdateButton`), `CCLChart` (doble eje Y: CCL y valor del portafolio en USD; ~12 ticks en X) y una tabla con los últimos 30 registros.
- **Estado vacío:** "Sin datos de CCL" con `CclUpdateButton` y referencia al Centro de Datos.

---

## `/snapshots` — Listado de snapshots

- **Archivo:** `app/(app)/snapshots/page.tsx`.
- **Datos:** `getAllSnapshotPoints()` (se invierte para mostrar el más reciente primero) y `getHoldingsFlows()`.
- **Muestra:** fecha, valor ARS, valor USD, CCL, cantidad de posiciones y rendimiento % del período sin aportes (`periodReturns`: sin badge si no hay base positiva); enlace a `/snapshots/[id]` con `prefetch={true}`, que resuelve el detalle antes del click (ADR-0017, punto 6).
- **Componentes:** `SiteHeader` (+`ImportButton`), `Badge`, `Separator`, links.

---

## `/snapshots/[id]` — Detalle de snapshot

- **Archivo:** `app/(app)/snapshots/[id]/page.tsx` (`params: Promise<{ id }>`).
- **Datos:** `getSnapshotById(id, userId)` (`lib/portfolio-data.ts`), cacheada por `(id, userId)` con el tag `snapshots:<userId>`. Un snapshot de otro usuario se comporta como inexistente.
- **Shell:** el header (título "Snapshot") entra al shell; la fecha (descripción), los botones de exportar y el detalle se streamean, cada uno en su `<Suspense>`, compartiendo la misma lectura cacheada.
- **Muestra:** KPIs (ARS, USD, CCL, posiciones), `AllocationPanel` y `HoldingsTable` (sin PPM ni precios en vivo).
- **Exportación:** `ExportButtons snapshotId={id}` → PDF, imprimir/vista previa, CSV.
- **Metadata:** `generateMetadata` con la misma lectura (`Snapshot <fecha>` en es-AR, o "Snapshot no encontrado"); se streamea junto con el resto de la página.
- **Errores:** `notFound()` si el id no existe.

---

## `/analysis` — Concentración

- **Archivo:** `app/(app)/analysis/page.tsx`.
- **Datos:** `getConcentrationData()` (usa el snapshot más reciente y cruza contra `Asset`) y `getSession()` (para mostrar "Completar Assets" solo a ADMIN).
- **Muestra:** donuts por **sector**, **país** e **industria** (`ConcentrationCharts`) y barras tipo Top 10; avisa el monto "sin clasificar" e invita a completar Assets.
- **Estado vacío:** icono `BarChart3`.

---

## `/rebalance` — Rebalanceo

- **Archivo:** `app/(app)/rebalance/page.tsx`.
- **Datos:** `getRebalanceData()` y `getTargetAllocations()` (ambas cacheadas con el tag `rebalance:<userId>`). `totalPct` = suma de objetivos.
- **Regla:** `deviation = currentPct − targetPct`; `BUY` si `< −1`, `SELL` si `> 1`, `HOLD` en el resto (umbral ±1 punto porcentual).
- **Componentes:** `SiteHeader`, `RebalanceClient` (tabla ordenable, alta/baja de objetivos, badge de total con alerta si se aleja de 100%).
- **Estado vacío:** icono `Scale`.

---

## `/plan` — Plan DCA

- **Archivo:** `app/(app)/plan/page.tsx`.
- **Propósito:** calcular de forma **determinista** (sin IA) cómo repartir el aporte mensual entre las posiciones del objetivo, priorizando las infraponderadas.
- **Datos:** `getLatestSnapshot()`, `getTargetAllocations()`, `getMarketPrices()`.
- **Lógica:** `planDca()` de `lib/dca-planner.ts` (pura y testeada) — water-filling sobre el *gap* de cada ticker (`targetPct% · valorCartera − valorActual`), sin comprar posiciones que ya alcanzaron su objetivo. Estima CEDEARs con el precio del subyacente y el CCL.
- **Componentes:** `SiteHeader`, `DcaPlannerClient` (input de aporte, tabla por ticker con desvío, monto a comprar, CEDEARs estimados y peso resultante).
- **Estados vacíos:** sin snapshot (CTA a `/datos`) y sin objetivos (CTA a `/rebalance`).

---

## `/retirement` — Planificación de jubilación

- **Archivo:** `app/(app)/retirement/page.tsx`.
- **Datos:** `getRetirementSettings()`, `getAllSnapshotPoints()`, `getHoldingsFlows()`; `currentPortfolioUsd` del último snapshot con `totalValueUsd`; `historicalCagr` es la TIR en USD (`holdingsXirr` con `flowsUsd`, `lib/flow-returns.ts`) sobre los snapshots con USD > 0 (requiere ≥2 y al menos 0,1 años).
- **Componentes:** `SiteHeader`, `RetirementClient` (tabs Calculadora, Proyección, Monte Carlo).
- **Cálculos:** `calculateRetirementGoal`, `buildProjectionCurve`, `runMonteCarlo` (500 simulaciones) de `lib/projections.ts`, memoizados. Tasa anual = `min(historicalCagr/100, 0.30)` o `0.07` por defecto.

---

## `/impuestos` — Reporte para impuestos

- **Archivo:** `app/(app)/impuestos/page.tsx`.
- **Datos:** `getTaxData()` (`lib/tax-report-data.ts`, tags `snapshots`, `trades` y `dividends` del usuario) y `searchParams.anio`, ambos dentro de `<Suspense>`. Sin `anio` válido muestra el último año cerrado con datos (`defaultTaxYear`).
- **Muestra, para el año elegido:**
  - **Tenencia al cierre** (Bienes Personales): posiciones del último snapshot del año. Avisa si ese snapshot está a más de 7 días del 31/12 o si no hay ninguno. No incluye el efectivo de la cuenta.
  - **Ventas** (Ganancias): ingreso neto, costo promedio con comisiones y resultado (`salesForYear`). Avisa si una venta supera las compras registradas o si se compró en otra moneda (sin resultado).
  - **Dividendos cobrados:** del libro de movimientos más los cargados a mano (`dividendsForYear`), con totales por moneda.
  - Selector de año (links `?anio=`) y botón **Descargar CSV** (`/api/export/impuestos?anio=`).
- **Componentes:** `SiteHeader`, `TaxReportView`, `TaxReportSkeleton`, `EmptyState` (sin datos).
- No es asesoramiento impositivo: no aplica exenciones ni convierte monedas (tipo de cambio BNA, etc.); eso queda para la declaración.

---

## `/transactions` — Transacciones

- **Archivo:** `app/(app)/transactions/page.tsx`.
- **Datos (`Promise.all`, todas cacheadas):** `getAllTransactions()`, `calculatePPM()`, `getRealizedPnl()`, `getMovements()` (tag `trades:<userId>`) y `getAllDividends()` (tag `dividends:<userId>`).
- **Muestra:** tabs de Transacciones, PPM, P&L realizado, Dividendos y **Movimientos** (con sub-vista **Fondos FCI**); exportar transacciones a CSV; importar movimientos de Cocos; formularios de transacción y dividendo.
- **Componentes:** `SiteHeader` (acciones `CsvExportButton`, `ImportMovimientosButton` y `DividendForm` en modo `compact` —solo ícono por debajo de `2xl`—, y `TransactionForm`), `TransactionsClient`.

---

## `/real-gains` — Ganancia Real en USD

- **Archivo:** `app/(app)/real-gains/page.tsx`. Los bloques visuales viven en `components/real-gains/` (`KpiCard`, `BreakdownBar`, `PositionsTable`, `MethodologyNote`, helpers de formato).
- **Datos:** `getDataReadiness()` y `calculateRealGains()` (ambas cacheadas, con un tag por dominio leído) y `getSession()`.
- **Muestra:** desglose de la ganancia en USD (valor actual vs costo) separando **apreciación del subyacente** e **impacto CCL**; tabla por posición con cobertura de datos; nota metodológica. Sólo incluye instrumentos con subyacente (CEDEARs); bonos y acciones locales quedan excluidos.
- **Componentes:** `SiteHeader` (acción `RealGainsUpdateButton` si hay análisis, en su propio `<Suspense>` para no sacar el header del shell), `RealGainsWizard` (2 pasos para poblar CCL histórico y precios históricos de subyacentes; refresca la página tras cada carga).

---

## `/assets` — Catálogo de CEDEARs **(ADMIN)**

- **Archivo:** `app/(app)/assets/page.tsx`.
- **Datos:** `getAssetCatalog()` (`app/actions/assets.ts`: exige ADMIN y lee el catálogo cacheado con el tag `assets`) y `getSetupStatus()` (tickers sin datos completos).
- **Muestra:** `AssetsQuickSetup` (completar de una vez los tickers detectados sin ratio/metadata) y tabla con ticker, ratio, subyacente, sector/industria/país y descripción; alta/edición/eliminación vía diálogo.
- **Acciones del header:** `CclUpdateButton`, `MarketPricesButton`, `ImportButton`.
- **Componentes:** `SiteHeader`, `AssetsQuickSetup`, `AssetsTableClient`.

---

## `/strategy` — Estrategia de inversión **(ADMIN)**

- **Archivo:** `app/(app)/strategy/page.tsx`.
- **Datos:** `getActiveStrategy()` y `getStrategyHistory()` (exigen ADMIN; lectura cacheada con el tag `strategy`).
- **Propósito:** editar el **system prompt** versionado que usa el análisis con Claude. Cada cambio crea una versión nueva inmutable; se puede restaurar una anterior (pasa a `isActive`).
- **Componentes:** `SiteHeader`, `StrategyEditor` (con `key` = id de la versión activa, para volver a montarse si cambió por fuera).

---

## `/settings` — Configuración **(ADMIN)**

- **Archivo:** `app/(app)/settings/page.tsx`.
- **Datos:** `getMilestones()` (solo lectura; los hitos por defecto se crean al importar el primer snapshot) y `getLatestSnapshot()`.
- **Propósito:** crear/eliminar **hitos** de valor en USD; se verifican automáticamente al importar un snapshot y se marca `reachedAt`.
- **Componentes:** `SiteHeader`, `MilestonesClient` (con `key` derivado de los hitos: copia la lista a su estado y `<Activity>` la conservaba vieja tras un import).

---

## `/guia` — Guía Cocos

- **Archivo:** `app/(app)/guia/page.tsx` (síncrona, sin lecturas de request: se prerenderiza entera en el static shell).
- **Datos:** ninguna.
- **Propósito:** explicar con esquemas interactivos (cada paso resalta qué tocar) cómo descargar el CSV de **Portfolio** (snapshots) y de **Actividad** (movimientos) desde Cocos. Es destino de anclas (`/guia#snapshots`, `/guia#transacciones`) y contiene los targets del tour de onboarding.
- **Componentes:** `SiteHeader`, `CocosGuide` (mapa de rutas Portfolio/Actividad, `GuideSection` con pasos que manejan `CocosMockup`, + `RestartTourButton`). Layout con container queries: en angosto cada sección es un visor (esquema, pasos 1-4, Anterior/Siguiente).

---

## Autenticación — `(auth)`

| Ruta | Archivo | Comportamiento |
|---|---|---|
| `/login` | `app/(auth)/login/page.tsx` + `login-form.tsx` | La página lee `searchParams` (`next`, validado contra open redirect) y `ALLOW_PUBLIC_SIGNUP` dentro de `<Suspense>` con `AuthCardSkeleton` de fallback. El form cliente llama a `signIn.email({ email, password })`; error genérico "Email o contraseña incorrectos."; éxito → `router.push(next)` + `refresh()`. |
| `/register` | `app/(auth)/register/page.tsx` + `register-form.tsx` | `await connection()` y chequeo de `ALLOW_PUBLIC_SIGNUP` dentro de `<Suspense>` (fallback `AuthCardSkeleton`); si el registro está cerrado redirige a `/login`. El form valida que las contraseñas coincidan y longitud ≥ 8; `signUp.email({ name, email, password })`; error 422 → "Ya existe una cuenta con ese email." El `role` nunca se envía (siempre `USER`). |

Ambas redirigen a `/` si ya hay sesión (proxy). El cliente de Better Auth (`lib/auth-client.ts`) usa `NEXT_PUBLIC_APP_URL` o, sin ella, el origen de la página.

---

## Resumen

| Ruta | Lecturas en el servidor | Fuente principal | ADMIN | Grupo del sidebar |
|---|---|---|---|---|
| `/` | Sí | `lib/*-data` + actions | No | Principal |
| `/snapshots` | Sí | snapshots | No | Principal |
| `/snapshots/[id]` | Sí | `getSnapshotById` (filtrado por `userId`) | No | — |
| `/ccl` | Sí | exchange rates + snapshots | No | Principal |
| `/performance` | Sí | snapshots + benchmarks + índices | No | Principal |
| `/analysis` | Sí | concentration | No | Análisis |
| `/real-gains` | Sí | real gains data | No | Análisis |
| `/rebalance` | Sí | actions rebalance | No | Análisis |
| `/plan` | Sí | snapshot + objetivos + precios | No | Análisis |
| `/retirement` | Sí | settings + snapshots | No | Análisis |
| `/impuestos` | Sí (+ `searchParams`) | snapshots + transacciones + dividendos | No | Análisis |
| `/datos` | Sí (por tarjeta) | setup + readiness + precios/CCL/índices | No | Datos |
| `/transactions` | Sí | actions transactions/dividends/movements | No | Datos |
| `/guia` | No | — | No | Datos |
| `/assets` | Sí | `getAssetCatalog` | **Sí** | Configuración |
| `/strategy` | Sí | actions strategy | **Sí** | Configuración |
| `/settings` | Sí | milestones + snapshot | **Sí** | Configuración |
| `/portfolio` | No | API de oportunidades (IA) + actions reports | **Sí** | Configuración |
| `/login`, `/register` | Solo request (`searchParams`, flag) | Better Auth client | No | — |

> Único redirect/error propio de página: `notFound()` en `/snapshots/[id]` (y la redirección de `/register` cuando el registro está cerrado). El resto de la protección es del proxy. Los errores no controlados caen en `app/(app)/error.tsx`.
>
> Para agregar una ruta admin hay que sumarla **en dos lugares**: `ADMIN_PATH_PREFIXES` en `proxy.ts` y `NAV_CONFIG` en `components/layout/app-sidebar.tsx`.
