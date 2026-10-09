# Componentes

Organizados por dominio. Los componentes de `components/ui/` son primitivas shadcn/ui (`radix-nova`) y no se documentan aquí. Convención: **CC** = Client Component (`"use client"`), **SC** = Server Component.

---

## Layout

| Componente | Tipo | Descripción |
|---|---|---|
| `layout/app-sidebar.tsx` — `AppSidebar` | CC | Sidebar colapsable con cuatro grupos: **Principal** (`NAV_MAIN`: Dashboard, Snapshots, Historial CCL, Performance), **Análisis** (`NAV_ANALYSIS`: Análisis, Ganancia Real, Rebalanceo, Plan DCA, Jubilación), **Datos** (`NAV_DATA`: Centro de Datos, Transacciones, Guía Cocos) y **Configuración** (`NAV_CONFIG`: Assets, Estrategia, Configuración, Oportunidades), que llega como slot `adminNav` (lo resuelve `layout/admin-nav.tsx` — `AdminNav`, SC — según el rol, detrás de `<Suspense>`). Item activo por `pathname.startsWith(href)` (excepto `/`); `usePathname()` va detrás de un `<Suspense>` por grupo, cuyo fallback dibuja los mismos links sin activo (en rutas con params dinámicos se suspende durante el prerender). Logout vía `signOut()`. Expone ids de tour: `tour-nav-snapshots`, `tour-nav-guia`, `tour-nav-transacciones`. |
| `layout/site-header.tsx` — `SiteHeader` | SC | Header sticky con `SidebarTrigger`, título, descripción (`ReactNode`: puede streamearse en su propio `<Suspense>`, como la fecha en `/snapshots/[id]`), `actions` a la derecha, `CommandMenu` y `ThemeToggle`. Va en el static shell de cada página. |
| `layout/command-menu.tsx` — `CommandMenu` | CC | Buscador global (⌘K / Ctrl+K) con `cmdk` (`CommandDialog`). Navega a las secciones principales, de análisis y de datos. |
| `theme-toggle.tsx` / `theme-provider.tsx` | CC | Toggle claro/oscuro y wrapper de `next-themes` (dark por defecto). |

---

## Dashboard (`components/dashboard/`)

| Componente | Tipo | Props / comportamiento |
|---|---|---|
| `dashboard-hero.tsx` | CC | `totalValueArs`, `totalValueUsd`, `snapshotDateFormatted`, `gainArs`, `gainPct`. Toggle ARS/USD (USD deshabilitado si es null); badge verde/rojo según la ganancia. |
| `dashboard-kpi-strip.tsx` | SC | `totalValueUsd`, `ccl`, `positionCount`, `gainPct`, `totalUnrealizedPnlArs`, `totalDividendsUsd` y flags de signo. Tira de KPIs secundarios. |
| `analysis-tools.tsx` | SC | `realGains`, `retirementGoal`, `retirementSettings`, `rebalanceData`, `topSector`, `totalSectors`. Tarjetas resumen que enlazan a Ganancia Real, Jubilación, Rebalanceo y Concentración. |
| `holdings-table.tsx` | SC | `positions`, `ppmData?`, `marketPrices?`. Tabla con barra de peso, PPM/P&L (solo si hay PPM en ARS) y valor USD en vivo (`(quantity / cedearRatio) × priceUsd`); pie con "total live USD" y timestamp. |
| `allocation-panel.tsx` | CC | `positions`, `totalArs`. Donut Recharts (`innerRadius 55%`) + leyenda con barras de progreso. |
| `performers-panel.tsx` | SC | `currentPositions`, `previousPositions`. Calcula `Δ%` de precio por ticker y muestra hasta 3 mejores y 3 peores. Retorna `null` si hay < 2 performers. |
| `portfolio-chart-widget.tsx` | SC | `snapshots`. Envuelve `PerformanceChart` en una tarjeta; `null` si hay < 2 snapshots. |
| `milestone-widget.tsx` | SC | `milestones`, `currentValueUsd`. Badges alcanzados y barra de progreso al próximo hito. |
| `empty-dashboard.tsx` | CC | Estado sin snapshots: CTA importar, link a la guía y 3 pasos. |

---

## Performance (`components/performance/`)

| Componente | Tipo | Descripción |
|---|---|---|
| `performance-chart.tsx` | CC | `snapshots`, `initialCurrency` opcional (la moneda elegida en `/performance`; la página le pasa `key` = moneda para que `<Activity>` no conserve la anterior). Línea de evolución con toggle ARS/USD (USD = `totalValueUsd` o `totalValueArs / ccl`). Usa `ChartContainer`. |
| `benchmark-overlay-chart.tsx` | CC | `snapshots`, `initialBenchmarks`, `portfolioIndex` opcional (índice TWR sin aportes; sin él normaliza el valor). Normaliza a base 100 y superpone S&P 500 / Merval / NASDAQ; carga datos on-demand con `fetchAndSaveBenchmark` + `getBenchmarkPoints` dentro de `useTransition`. |
| `inflation-chart.tsx` | CC | `snapshots`, `initialIndices`, `portfolioIndex` opcional (como en el de benchmarks). Portfolio en ARS vs IPC acumulado y CER/UVA, base 100; escala logarítmica por defecto; descarga los índices on-demand (`fetchAndSaveInflation` / `fetchAndSaveCer` + `getIndexPoints`). |

---

## Plan DCA (`components/plan/`)

| Componente | Tipo | Descripción |
|---|---|---|
| `dca-planner-client.tsx` | CC | `portfolioValueArs`, `ccl`, `positions`, `targets`, `assets`, `marketPrices`. Input del aporte (default $500.000), corre `planDca()` (`lib/dca-planner.ts`) en el cliente y muestra por ticker el desvío, el monto a comprar, los CEDEARs estimados y el peso resultante. |

---

## Análisis (`components/analysis/`)

| Componente | Tipo | Descripción |
|---|---|---|
| `concentration-charts.tsx` | CC | `data`. Tabs Sector / País / Industria con donuts y leyenda (top 8); nota de monto sin clasificar. |
| `opportunity-analyzer.tsx` | CC | `OpportunityAnalyzer`: botón "Generar reporte" → `POST /api/analyze-portfolio` (sin cuerpo: usa el último snapshot), con cancelación y el último reporte en `localStorage` (leído con `useSyncExternalStore`). |
| `opportunity-report.tsx` | SC | `OpportunityReportDisplay`: resumen, conteo por señal, acciones agrupadas (compra / venta / mantener) con precio, noticias, motivo, riesgos y confianza, y al pie modelo, tokens y costo. |
| `legacy-report.tsx` | SC | `ReporteDisplay` y el tipo `ReportePortafolio`: visor de los reportes del formato anterior (plan de aporte con asignaciones), solo para el historial. |
| `signal-history.tsx` | SC | `history: SignalHistory`. Tabla de señales por acción: una columna por reporte (los últimos 6), con la señal y su confianza; marca "cambió" cuando la última difiere de la anterior. |
| `report-historial.tsx` | CC | Lista reportes (`listReports`) y muestra el seleccionado (`getReport`) con `OpportunityReportDisplay` si es `version: 2`, o con `ReporteDisplay` si es del formato anterior. |

---

## Snapshots (`components/snapshots/`)

| Componente | Tipo | Descripción |
|---|---|---|
| `snapshots-client.tsx` — `ImportButton` | CC | Botón "Importar CSV" (`id="tour-import-snapshot"`) que abre el sheet. |
| `import-csv-sheet.tsx` | CC | Flujo de 3 pasos: seleccionar → previsualizar → completado. Valida el nombre `portfolio_report_AAAAMMDD.csv`, deriva la fecha, autocompleta el CCL (`getExchangeRateForDate`), muestra la tabla de posiciones y bloquea la confirmación si `missingCcl`. |

---

## Transacciones (`components/transactions/`)

| Componente | Tipo | Descripción |
|---|---|---|
| `transactions-client.tsx` | CC | Tabs Transacciones / PPM / P&L Realizado / Dividendos / **Movimientos**. El tab de Movimientos tiene sub-vistas "Todos" y "Fondos FCI" (aporta/rescata/neto por fondo). Eliminación con `AlertDialog`; fechas en `timeZone: "UTC"`. |
| `transaction-form.tsx` | CC | Diálogo para registrar BUY/SELL (`createTransaction`). En mobile el botón muestra solo el ícono. |
| `dividend-form.tsx` | CC | Diálogo para registrar dividendos (`createDividend`, USD por defecto). Prop `compact`: solo ícono por debajo de `2xl` (header de `/transactions`). |
| `expenses-section.tsx` | SC | `summary`, `expenses`, `currentMonthKey`, `usdPayments`. Sección "Gastos del mes" de `/transactions`: navegación entre meses (links `?mes=`), KPIs, gráfico por día (`ExpensesDailyChart`, barras con Recharts), total por categoría y `ExpensesTable`. |
| `expenses-table.tsx` | CC | `expenses`. Lista de pagos del mes con categoría (`Select` de shadcn: la lista del `<select>` nativo no toma el tema) y nota editables; guarda al cambiar la categoría o al salir de la nota (`saveExpenseTag`) y vuelve al valor anterior si falla. Switch "Solo sin categoría". La sección le pasa `key` = mes. |
| `import-movements-button.tsx` | CC | Importación de movimientos de Cocos. Prop `compact` (header de `/transactions`): solo ícono por debajo de `2xl`, sin el link a la guía y con el aviso de error flotando. Parsea el CSV en el cliente (`parseMovementCsv`) y muestra una previsualización **agrupada por categoría** con checkboxes por grupo y por fila (todo seleccionado por defecto). Avisos para tipos no reconocidos y trades sin ticker. Al confirmar llama a `importMovements`. `id="tour-import-movimientos"`. |

---

## Resto de módulos

| Componente | Tipo | Descripción |
|---|---|---|
| `rebalance/rebalance-client.tsx` | CC | `rebalanceData`, `targets`, `totalPct`. Tabla ordenable, acciones sugeridas (Comprar/Vender/Mantener), alta/baja de objetivos y badge de total (alerta si se aleja de 100%). |
| `retirement/retirement-client.tsx` | CC | `initialSettings`, `currentPortfolioUsd`, `historicalCagr`, `realContribution` (aporte real de los últimos 12 meses o `null`; botones "Usar" que guardan ese aporte con `saveRetirementSettings`). Tabs Calculadora / Proyección / Monte Carlo; cálculos memoizados con `JSON.stringify(inputs)`; tasa anual = `expectedReturnRate` configurado (7 % por defecto); `historicalCagr` (TIR histórica en USD) se muestra solo como referencia. |
| `strategy/strategy-editor.tsx` | CC | `active`, `history`. Editor del system prompt con versionado (guardar nueva versión / restaurar versión anterior). Copia el contenido a su estado: la página le pasa `key` = id de la versión activa. |
| `settings/milestones-client.tsx` | CC | `initialMilestones`, `currentPortfolioUsd`. Alta/baja de hitos y progreso al próximo. Copia la lista a su estado: la página le pasa un `key` derivado de los hitos. |
| `real-gains/real-gains-wizard.tsx` | CC | `readiness`. Wizard de 2 pasos: backfill de CCL histórico y de precios históricos de subyacentes. Tras cada carga hace `router.refresh()`; el aviso de éxito solo aparece después de una carga hecha en esa visita. |
| `real-gains/real-gains-update-button.tsx` | CC | Actualiza CCL histórico y precios de acciones en paralelo (`Promise.all`). |
| `real-gains/kpi-card.tsx`, `breakdown-bar.tsx`, `positions-table.tsx`, `methodology-note.tsx` | SC | Bloques de `/real-gains`: KPIs, barra de desglose apreciación vs impacto CCL, tabla por posición con cobertura de datos y nota metodológica. Reciben `RealGainsSummary`. |
| `cash-flow/cash-flow-chart.tsx` | CC | `months: MonthCashFlow[]`. Barras de depósitos y gastos por mes (eje en pesos) y línea de la tasa de ahorro (eje en %), con `ComposedChart`. |
| `taxes/tax-report-view.tsx` | SC | `report: TaxReport`. Las tres secciones de `/impuestos` (tenencia al cierre, ventas, dividendos) con tablas, totales por moneda y avisos (snapshot fuera del cierre, ventas sin compras o en otra moneda). |
| `alerts/alert-settings-form.tsx` | CC | `initial`, `mailerReady`. Formulario de `/alertas`: switch de activación, umbrales y día del recordatorio, y botones Guardar / Mandar mail de prueba / Revisar ahora (deshabilitados sin Gmail configurado). Copia la configuración a su estado: la página le pasa un `key` derivado de los datos. |
| `market/indices-update-button.tsx` | CC | Actualiza IPC y CER/UVA juntos (`fetchAndSaveAllIndices`). Se usa en `/datos`; en `/performance`, `InflationChart` descarga cada índice por separado. |
| `ccl/ccl-chart.tsx` | CC | `rates`, `snapshots`. Gráfico de CCL con overlay del portafolio USD (doble eje Y). |
| `exchange-rate/ccl-update-button.tsx` | CC | Actualiza el CCL actual (`fetchAndSaveCCL`); toast indica si ya existía. En `/datos`, `/ccl` y `/assets` (ahí con `compact`: solo ícono por debajo de `2xl`). |
| `market/market-prices-button.tsx` | CC | Actualiza precios de mercado (`fetchAndSaveMarketPrices`); reporta fallos. En `/datos` y `/assets` (ahí con `compact`). |
| `assets/asset-dialog.tsx` | CC | Diálogo crear/editar CEDEAR (en edición no permite cambiar ticker). |
| `assets/assets-table-client.tsx` | CC | Tabla del catálogo con alta/edición/eliminación y confirmación. |
| `export/csv-export-button.tsx` | CC | Abre una ruta de exportación CSV. Prop `compact`: solo ícono por debajo de `2xl`. |
| `guide/cocos-guide.tsx` | CC | Guía de descarga de CSV: mapa Portfolio→Snapshots / Actividad→Transacciones y una sección por archivo cuyos pasos (botones) eligen la pantalla del esquema. `RestartTourButton`. Secciones con ids `tour-guide-snapshots` y `tour-guide-transacciones`. |
| `guide/cocos-mockup.tsx` | CC | `CocosMockup`: esquema de celular (menú, pantalla, panel de descarga) con el elemento a tocar resaltado; lo desconocido de Cocos va como bloque neutro. |

---

## Skeletons (fallbacks de `<Suspense>`)

Cada página pone sus lecturas dentro de `<Suspense>` con un skeleton que también usa su `loading.tsx`, así el fallback de la navegación y el del streaming son el mismo (ADR-0017).

| Componente | Ruta |
|---|---|
| `dashboard/dashboard-skeleton.tsx` — `DashboardSkeleton` | `/` |
| `snapshots/snapshots-skeleton.tsx`, `snapshots/snapshot-detail-skeleton.tsx` | `/snapshots`, `/snapshots/[id]` |
| `ccl/ccl-skeleton.tsx` | `/ccl` |
| `performance/performance-skeleton.tsx` | `/performance` |
| `analysis/analysis-skeleton.tsx` | `/analysis` |
| `real-gains/real-gains-skeleton.tsx` | `/real-gains` |
| `rebalance/rebalance-skeleton.tsx`, `plan/plan-skeleton.tsx` | `/rebalance`, `/plan` |
| `retirement/retirement-skeleton.tsx` | `/retirement` |
| `cash-flow/cash-flow-skeleton.tsx` | `/flujo` |
| `taxes/tax-report-skeleton.tsx` | `/impuestos` |
| `alerts/alerts-skeleton.tsx` | `/alertas` |
| `transactions/transactions-skeleton.tsx` (`TransactionsSkeleton`, `ExpensesSkeleton`) | `/transactions` |
| `assets/assets-skeleton.tsx`, `strategy/strategy-skeleton.tsx`, `settings/milestones-skeleton.tsx` | `/assets`, `/strategy`, `/settings` |
| `auth/auth-card-skeleton.tsx` — `AuthCardSkeleton` | `/login`, `/register` (mismo fondo y tarjeta que los formularios) |

---

## Onboarding (tours)

Sistema de tour de primer uso basado en `nextstepjs`, activo solo en el Dashboard y la Guía.

| Archivo | Rol |
|---|---|
| `components/onboarding/onboarding-provider.tsx` | Configura `NextStep` con `onboardingSteps`, la card custom, los sincronizadores y `useTourNavigationAdapter`. El tour ya **no se auto-inicia**: es una ayuda contextual opcional. |
| `components/onboarding/tour-navigation-adapter.tsx` | Adaptador de navegación de `NextStep` que no llama a `usePathname()` en el render (lo haría fuera de `<Suspense>` y bloquearía el static shell de rutas con params como `/snapshots/[id]`). La ruta sale de un store con `useSyncExternalStore`; `PathnameReporter`, dentro de su propio `<Suspense>`, avisa cada navegación. |
| `components/onboarding/onboarding-card.tsx` | Card del tour: barra de progreso, pasos, botones Omitir / Anterior / Siguiente-Finalizar. |
| `components/onboarding/tour-highlight-sync.tsx` | Marca el elemento activo con `data-tour-highlight`. |
| `components/onboarding/tour-position-sync.tsx` | Re-ancla spotlight/card en scroll y resize (nextstepjs no escucha scroll). |
| `components/onboarding/tour-scroll-sync.tsx` | Hace scroll al target del paso en el sidebar o en la guía. Lee `usePathname()`, así que va dentro de `<Suspense>`. |
| `lib/onboarding/steps.tsx` | Define `PRIMER_USO_TOUR` con 6 pasos que recorren `/` y `/guia`. |
| `lib/onboarding/tour-targets.ts` | Índices de pasos, selectores del sidebar y helpers de scroll. |

El tour se lanza desde la Guía (`RestartTourButton`) o tras finalizar el wizard.

## Setup / Onboarding de datos

El onboarding principal es un **wizard accionable** que guía la carga de datos en orden. Su estado vive en la base (`UserSetup`), no en `localStorage`.

| Componente | Tipo | Descripción |
|---|---|---|
| `setup/setup-panel.tsx` | CC | Orquesta wizard + checklist + una única instancia de `ImportCsvSheet`. Se monta en el Dashboard. |
| `setup/welcome-wizard.tsx` | CC | Wizard de bienvenida de 6 pasos. Se auto-abre si `onboarding.shouldShowWizard`. Permite omitir, reanudar y finalizar (`completeOnboarding`). |
| `setup/setup-checklist.tsx` | CC | Checklist "Puesta en marcha" con progreso, estado por paso y CTA. Se usa en el Dashboard y en `/datos`. |
| `assets/assets-quick-setup.tsx` | CC | Completa en lote los Assets detectados en el snapshot (ratio obligatorio + subyacente/sector/país/industria). Aparece en `/assets`. |
| `ui/empty-state.tsx` | SC | Estado vacío consistente (ícono + título + descripción + acción). |
| `ui/info-tooltip.tsx` | CC | Ícono "?" con la definición del término del glosario (`lib/glossary.ts`). |

Targets usados por los componentes: `#tour-import-snapshot`, `#tour-import-movimientos`, `#tour-nav-snapshots`, `#tour-nav-guia`, `#tour-nav-transacciones`, `#tour-guide-snapshots`, `#tour-guide-transacciones`.

---

## Estilos y animaciones

- **Sistema de diseño:** ver [`DESIGN.md`](../DESIGN.md) — tokens Azure Tech (color, tipografía, radios, sombras, utilidades). Usar siempre tokens semánticos (`text-success`, `bg-warning/10`, `text-destructive`, `text-info`) y `var(--color-chart-*)`; nunca colores crudos de Tailwind.
- Layout de página: `<div className="flex flex-col min-h-svh">` con `section` que usan `animate-fade-up` y `animationDelay` progresivo (0, 100, 200 ms…).
- KPIs: patrón `border bg-card shadow-sm px-5 py-4`, grillas `grid-cols-2 sm:grid-cols-4`.
- Números y fechas: `Intl.NumberFormat` / `Intl.DateTimeFormat` con locale `"es-AR"` (y `"en-US"` para USD).
