# Server Actions (`app/actions/`)

Todas las mutaciones de la app pasan por Server Actions (`"use server"`). Cada archivo corresponde a un dominio. Patrón general: validar → operar con Prisma → invalidar el caché con los helpers de `lib/revalidate.ts` → devolver una unión discriminada.

### Caché e invalidación (`lib/cache-tags.ts`, `lib/revalidate.ts`)

Las lecturas se cachean con `'use cache'` + `cacheLife("hours")` + `cacheTag` ([ADR-0017](./adr/0017-cache-components-partial-prerendering-y-prefetching.md)). El getter exportado resuelve el usuario de la sesión y llama a una función cacheada **no exportada** que recibe solo el `userId` (en un archivo `"use server"`, una función exportada que recibiera el `userId` sería una action invocable con cualquier id). Cada función cacheada declara un tag por cada dominio que lee:

| Tag | Dominio | Helper que lo invalida |
|---|---|---|
| `snapshots:<userId>` | Snapshots y posiciones | `revalidatePortfolioData(userId)` |
| `trades:<userId>` | Transacciones y movimientos | `revalidateTrades(userId)` |
| `dividends:<userId>` | Dividendos | `revalidateDividends(userId)` |
| `milestones:<userId>` | Hitos | `revalidateMilestones(userId)` |
| `retirement:<userId>` | Configuración de retiro | `revalidateRetirement(userId)` |
| `rebalance:<userId>` | Asignación objetivo | `revalidateRebalance(userId)` |
| `setup:<userId>` | Estado de onboarding | `revalidateSetup(userId)` |
| `assets` | Catálogo de assets | `revalidateAssets()` |
| `ccl` | `ExchangeRate` | `revalidateCcl()` |
| `market-prices` | `MarketPriceCache` | `revalidateMarketPrices()` |
| `historical-prices` | `HistoricalPriceCache` | `revalidateHistoricalPrices()` |
| `benchmarks` | Benchmarks e índices | `revalidateBenchmarks()` |
| `strategy` | Estrategia | `revalidateStrategy()` |

Los helpers usan `updateTag`: la siguiente lectura (incluso dentro de la misma action) espera datos frescos, y además se vacía el caché del router en el cliente, así que no hace falta `revalidatePath`. `updateTag` solo funciona en Server Actions; en un Route Handler usar `revalidateTag(tag, "max")`.

Lecturas cacheadas hoy: las del Dashboard (`getLatestSnapshot`, `getPreviousSnapshotFull`, `getAllSnapshotPoints`, `getConcentrationData`, `calculateRealGains`, `calculatePPM`, `getMarketPrices`, `getTotalDividendsUsd`, `getMilestones`, `getRetirementSettings`, `getRebalanceData` y `getSetupStatus`) y `getAllExchangeRates` (tag `ccl`). Al cachear una lectura nueva, sumá un tag por cada dominio que lee; al agregar una escritura, llamá al helper de su dominio.

Autorización: las actions que leen/escriben datos de usuario llaman a `requireAuth()`/`requireUserId()` (lanzan si no hay sesión) y filtran por `userId`, **incluidos los borrados** (`deleteMany({ where: { id, userId } })`, que devuelve "no encontrado" si el registro es ajeno). Las actions sobre datos administrados (`assets.ts`, `strategy.ts`) llaman a `requireAdmin()`. Las de refresco de datos de mercado (exchange-rate, benchmarks, precios) **no** llaman a `requireAuth`: dependen solo de que el proxy exija sesión.

| Helper (`lib/auth-session.ts`) | Uso |
|---|---|
| `requireAuth()` | Lanza `"No autenticado"` sin sesión; devuelve la sesión. |
| `requireUserId()` | `requireAuth()` + devuelve `session.user.id`. Para todo dato de usuario. |
| `requireAdmin()` | `requireAuth()` + lanza `"No autorizado. Se requiere rol administrador."` si el rol no es ADMIN. |

---

## `assets.ts` — Catálogo de CEDEARs

El catálogo es **global (compartido)**: lectura para todos, **escritura sólo ADMIN**. Cada mutación llama a `requireAdmin()` (defensa en profundidad, además del proxy).

| Función | Comportamiento |
|---|---|
| `createAsset(data)` | Valida ticker no vacío y `cedearRatio > 0`; normaliza ticker/subyacente a mayúsculas. Error amigable si el ticker ya existe. `revalidateAssets()`. |
| `updateAsset(id, data)` | Actualiza solo campos definidos; **no permite cambiar `ticker`**. |
| `deleteAsset(id)` | Elimina por id (el catálogo es global; la protección es el rol ADMIN). |

`AssetFormData`: `ticker`, `instrumentName?`, `cedearRatio`, `description?`, `sector?`, `industry?`, `country?`, `underlyingTicker?`.

---

## `snapshots.ts` — Importación de snapshots

| Función | Auth | Comportamiento |
|---|---|---|
| `checkSnapshotDate(dateStr)` | No | Devuelve `{ exists }` si el usuario ya tiene un snapshot en esa fecha. El sheet de import lo consulta al elegir la fecha para avisar antes de previsualizar. |
| `parseSnapshotPreview(formData)` | No | Parsea el CSV (`file`), calcula totales y allocations, informa `hasUsdPositions` y `missingCcl`. Si recibe `date` y ya existe un snapshot ese día, devuelve el error de duplicado. No escribe. |
| `importSnapshot(formData)` | Sí | Valida archivo/fecha; rechaza posiciones USD sin CCL; verifica que no exista un snapshot para esa fecha (inmutabilidad); crea `PortfolioSnapshot` con `positions` anidadas; `totalValueUsd = totalValueArs / ccl`; llama a `checkAndUpdateMilestones`. Devuelve `positionCount`, `totalValueArs` y `nextStep` (primer paso accionable pendiente del checklist) para la pantalla de éxito. |
| `deleteSnapshot(id)` | Sí | `deleteMany({ id, userId })`. Los snapshots son inmutables (no se editan), pero el usuario puede borrar los propios. UI: botón "Eliminar snapshot" con confirmación en `/snapshots/[id]`. |

Detalles del parser en [logica-financiera.md](./logica-financiera.md#parsing-de-csv-de-cocos).

---

## `transactions.ts` — Operaciones

| Función | Auth | Comportamiento |
|---|---|---|
| `createTransaction(data)` | Sí | Valida ticker, `quantity > 0`, `price > 0` y fecha válida. Guarda con `userId`. |
| `deleteTransaction(id)` | Sí | `deleteMany({ id, userId })`; `revalidateTrades()`. |
| `getAllTransactions()` | Sí | Devuelve las transacciones del usuario ordenadas por fecha desc. |
| `calculatePPM()` | Sí | Ver [PPM](./logica-financiera.md#ppm--precio-promedio-ponderado-calculateppm). |
| `getRealizedPnl()` | Sí | Ver [P&L realizado](./logica-financiera.md#realizado-getrealizedpnl). |

---

## `dividends.ts` — Dividendos

| Función | Auth | Comportamiento |
|---|---|---|
| `createDividend(data)` | Sí | Valida ticker, `amount > 0`, fecha válida. `revalidateDividends()`. |
| `deleteDividend(id)` | Sí | `deleteMany({ id, userId })`. |
| `getAllDividends()` | Sí | Dividendos del usuario por fecha desc. |
| `getTotalDividendsUsd()` | Sí | Suma de dividendos en USD del usuario. |

---

## `import-movements.ts` — Libro de movimientos de Cocos

El parser puro vive en `lib/cocos-movements.ts` (`parseMovementCsv`), no en este archivo.

| Función | Auth | Comportamiento |
|---|---|---|
| `importMovements(movements, sourceFile?)` | Sí | Persiste el libro de movimientos de forma **idempotente**. Deduplica por `Movement.(userId, nroTicket)` (y por compatibilidad con `Transaction.notes = "Cocos #<ticket>"` legacy). En una transacción `$transaction`: inserta `Movement` con `createManyAndReturn` + `skipDuplicates` y crea una `Transaction` para cada `TRADE_BUY`/`TRADE_SELL` con ticker, cantidad y precio. Devuelve `imported`, `transactionsCreated`, `duplicates` y `byCategory`. |
| `getMovements(categories?)` | Sí | Devuelve el libro de movimientos del usuario (opcionalmente filtrado por categoría) ordenado por fecha desc, con `transactionId` asociado. |

El parser clasifica cada fila en `MovementCategory`; sólo `TRADE_BUY`/`TRADE_SELL` generan transacción. Detalle de la categorización en [logica-financiera.md](./logica-financiera.md#parsing-de-csv-de-cocos).

---

## `rebalance.ts` — Asignación objetivo

| Función | Auth | Comportamiento |
|---|---|---|
| `getRebalanceData()` | Sí | Snapshot más reciente + objetivos → filas con `currentPct`, `targetPct`, `deviation` y `suggestedAction`; ordena por `|deviation|` desc. |
| `getTargetAllocations()` | Sí | Objetivos del usuario (`targetPct` ×100). |
| `upsertTargetAllocation(ticker, targetPct, notes?)` | Sí | Valida ticker y `0 ≤ targetPct ≤ 100`; persiste `targetPct/100`. Upsert por la unique `[userId, ticker]`. |
| `deleteTargetAllocation(id)` | Sí | `deleteMany({ id, userId })`; no elimina objetivos de otros usuarios. |

---

## `retirement.ts` — Configuración de jubilación

| Función | Auth | Comportamiento |
|---|---|---|
| `getRetirementSettings()` | Sí | Primer registro del usuario o `null`. |
| `saveRetirementSettings(data)` | Sí | Valida `1 ≤ currentAge ≤ 100`, `retirementAge > currentAge` y `monthlyExpensesUsd > 0`; actualiza el registro existente o crea uno nuevo. |

---

## `milestones.ts` — Hitos

| Función | Auth | Comportamiento |
|---|---|---|
| `getMilestones()` | Sí | Hitos del usuario; si no tiene, crea los 5 por defecto. |
| `createMilestone(label, targetValueUsd)` | Sí | Valida label y valor positivo. |
| `deleteMilestone(id)` | Sí | `deleteMany({ id, userId })`. |
| `checkAndUpdateMilestones(currentValueUsd)` | Sí | Marca como alcanzados los hitos cumplidos. Invocada desde `importSnapshot`. |

---

## `exchange-rate.ts` — CCL

Datos globales, **sin `requireAuth`**.

| Función | Comportamiento |
|---|---|
| `fetchAndSaveCCL()` | Obtiene el CCL actual de dolarapi.com, hace upsert por fecha. |
| `fetchHistoricalCCL(from, to?)` | Descarga la serie de argentinadatos.com y hace upsert del rango, reportando `saved`/`skipped`. |
| `getAllExchangeRates()` | Todo el historial ordenado asc. Cacheado con el tag `ccl` (`await connection()` antes, por ser global). |
| `getExchangeRateForDate(dateStr)` | CCL exacto de una fecha (usado para autocompletar al importar). |

---

## `market-prices.ts` — Precios actuales

Datos globales, **sin `requireAuth`**.

| Función | Comportamiento |
|---|---|
| `fetchAndSaveMarketPrices()` | `getQuotes` de Yahoo para los `underlyingTicker` de `Asset`; upsert en `MarketPriceCache`; reporta `updated` y `failed`. |
| `getMarketPrices()` | Precios cacheados junto con ticker, subyacente y ratio. |

---

## `historical-prices.ts` — Precios históricos de subyacentes

Datos globales, **sin `requireAuth`**.

| Función | Comportamiento |
|---|---|
| `fetchAndCacheStockHistory()` | Para cada `Asset` con `underlyingTicker`, descarga el histórico desde la primera compra (o −365 días) hasta hoy y hace upsert en `HistoricalPriceCache`. Un fallo por ticker no aborta el resto. |

---

## `benchmarks.ts` — Benchmarks

Datos globales, **sin `requireAuth`**.

| Función | Comportamiento |
|---|---|
| `fetchAndSaveBenchmark(benchmarkId, fromDate, toDate?)` | Descarga el histórico del índice (`sp500`→`^GSPC`, `merval`→`^MERV`, `nasdaq`→`^IXIC`) y hace upsert en `BenchmarkPoint`. |
| `getBenchmarkPoints(benchmarkId, fromDate?)` | Puntos normalizados a base 100. |

---

## `indices.ts` — Inflación (IPC) y CER/UVA

Datos globales en `BenchmarkPoint` (fuente: argentinadatos.com). Reutiliza `getBenchmarkPoints` para la lectura.

| Función | Auth | Comportamiento |
|---|---|---|
| `fetchAndSaveInflation(fromDate)` | No | Descarga el IPC mensual (tasas %), arranca un mes antes de `fromDate` y lo convierte en **índice acumulado base 100** con `buildCumulativeIndex` (`lib/inflation.ts`). Upsert como `benchmarkId: "inflacion"`. |
| `fetchAndSaveCer(fromDate)` | No | Descarga la UVA diaria (proxy del CER, ya es un índice) y la guarda directo como `benchmarkId: "cer"`. |
| `getIndexPoints(indexId, fromDate?)` | No | Alias de `getBenchmarkPoints` (normaliza a base 100). |
| `fetchAndSaveAllIndices()` | Sí | Actualiza ambos índices en paralelo desde el primer snapshot del usuario (o 5 años atrás). Falla solo si fallan los dos. Lo usa `IndicesUpdateButton`. |

---

## `setup.ts` — Onboarding y estado de puesta en marcha

| Función | Auth | Comportamiento |
|---|---|---|
| `getSetupStatus()` | Sí | Deriva el estado de cada paso (snapshot, assets, transacciones, históricos, preferencias) cruzando datos reales + metadata de `UserSetup`. Para un `USER` el paso Assets es informativo (`actionable: false`, no requerido ni contado) porque el catálogo es admin-only. Ver `lib/setup-status.ts` (lógica pura). |
| `completeOnboarding()` | Sí | Marca `onboardingCompletedAt`. |
| `dismissOnboarding()` | Sí | Marca `onboardingDismissedAt` (omitir). |
| `setOnboardingStep(step)` | Sí | Guarda `lastStep` para reanudar el wizard. |
| `restartOnboarding()` | Sí | Limpia completado/omitido para volver a mostrar el wizard. |

La completitud de cada paso **no se guarda**: se deriva de `PortfolioSnapshot`, `Asset`, `Transaction`, `ExchangeRate` y `HistoricalPriceCache`. En `UserSetup` sólo vive la metadata de presentación (completado/omitido/paso).

---

## `strategy.ts` — Estrategia de inversión

Datos globales, **solo ADMIN**: todas las funciones llaman a `requireAdmin()` (`lib/auth-session.ts`), además de la protección de la página `/strategy` en el proxy. `POST /api/analyze-portfolio` lee la estrategia activa directo de la DB, sin pasar por estas actions.

| Función | Comportamiento |
|---|---|
| `getActiveStrategy()` | Estrategia con `isActive = true`. Lanza si el usuario no es ADMIN. |
| `getStrategyHistory()` | Todas las versiones por fecha desc. Lanza si el usuario no es ADMIN. |
| `saveNewVersion(content, title)` | `{ ok: false, error }` si no es ADMIN. Valida contenido/título; en transacción desactiva la actual y crea la versión `N+1` activa. |
| `restoreVersion(id)` | `{ ok: false, error }` si no es ADMIN. En transacción desactiva todas y activa la indicada. |

---

## `reports.ts` — Reportes mensuales

Por usuario: ambas funciones usan `requireUserId()` y filtran por `userId`. Los reportes se crean en `POST /api/analyze-portfolio`, no en una action.

| Función | Comportamiento |
|---|---|
| `listReports()` | Lista `id` + label (`fechaReporte — hora`) del usuario por fecha desc. |
| `getReport(id)` | `findFirst({ id, userId })`; devuelve `normalizedJson` casteado a `ReportePortafolio` o `null`. |

---

## Matriz de autorización

| Archivo | `requireAuth` | Filtra por `userId` |
|---|---|---|
| `assets.ts` | Sí (admin) | No (catálogo global) |
| `benchmarks.ts` | No | No |
| `dividends.ts` | Sí | Sí (incluye delete) |
| `exchange-rate.ts` | No | No (global) |
| `historical-prices.ts` | No | No (global) |
| `import-movements.ts` | Sí | Sí |
| `indices.ts` | Solo `fetchAndSaveAllIndices` | No (global; usa el primer snapshot del usuario como fecha de inicio) |
| `market-prices.ts` | No | No (global) |
| `milestones.ts` | Sí | Sí (incluye delete) |
| `rebalance.ts` | Sí | Sí |
| `reports.ts` | Sí | Sí |
| `retirement.ts` | Sí | Sí |
| `setup.ts` | Sí | Sí (por usuario) |
| `snapshots.ts` | Sí (import/delete; `parseSnapshotPreview` no escribe) | Sí |
| `strategy.ts` | Sí (admin) | No (global) |
| `transactions.ts` | Sí | Sí (incluye delete) |

> **Por qué el rol se chequea en la action:** las Server Actions se invocan con un POST a la página desde donde se llaman, así que el proxy exige sesión pero **no** rol. Toda action sobre datos administrados usa `requireAdmin()`.
>
> **Deuda técnica conocida:** las actions de refresco de datos de mercado (`exchange-rate`, `market-prices`, `historical-prices`, `benchmarks`, y las de `indices.ts` salvo `fetchAndSaveAllIndices`) no llaman a `requireAuth`: dependen de que el proxy exija sesión. Solo escriben caches globales de datos públicos.
