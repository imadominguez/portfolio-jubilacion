# Modelo de datos

Fuente: `prisma/schema.prisma`. El cliente se genera en `app/generated/prisma` (`provider = "prisma-client"`, `output = "../app/generated/prisma"`). El datasource es `postgresql` y la URL se inyecta desde `prisma.config.ts` con `env("DATABASE_URL")`.

Convención: los modelos de auth se mapean a tablas en minúscula (`@@map`); el resto usa `snake_case`.

---

## Enums

```prisma
enum Currency         { ARS  USD }
enum TransactionType  { BUY  SELL }
enum UserRole         { USER ADMIN }
enum AssetKind        { CEDEAR FCI OTHER }
enum MovementCategory {
  TRADE_BUY TRADE_SELL
  FCI_SUBSCRIPTION FCI_REDEMPTION
  PAYMENT RECEIPT
  DIVIDEND DIVIDEND_IN_KIND
  CONVERSION OTHER
}
enum AlertKind        { PRICE_DROP REMINDER }
```

- `AssetKind` clasifica el catálogo (`CEDEAR`, `FCI`, `OTHER`).
- `MovementCategory` es la categoría normalizada de cada fila del CSV de movimientos de Cocos.

---

## Autenticación (Better Auth)

### `User` → tabla `user`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id` | |
| `name` | `String` | |
| `email` | `String @unique` | |
| `emailVerified` | `Boolean` | |
| `image` | `String?` | |
| `role` | `UserRole @default(USER)` | Campo adicional expuesto en la sesión. |
| `createdAt` / `updatedAt` | `DateTime` | |

Relaciones: `sessions`, `accounts`, `portfolioSnapshots`, `transactions`, `dividends`, `retirementSettings`, `milestoneAlerts`, `portfolioReports`, `movements`, `setup`.

### `Session` → `session`
`id`, `expiresAt`, `token @unique`, `createdAt`, `updatedAt`, `ipAddress?`, `userAgent?`, `userId` (FK a `User`, `onDelete: Cascade`).

### `Account` → `account`
`id`, `accountId`, `providerId`, `userId` (FK cascade), tokens OAuth (`accessToken?`, `refreshToken?`, `idToken?`, expiraciones, `scope?`) y `password?` (hash de credenciales), timestamps.

### `Verification` → `verification`
`id`, `identifier`, `value`, `expiresAt`, `createdAt?`, `updatedAt?`.

---

## Dominio del portafolio

### `PortfolioSnapshot` → `portfolio_snapshots`

Registro **inmutable** del estado del portafolio en una fecha.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `snapshotDate` | `DateTime @db.Date` | |
| `totalValueArs` | `Decimal(18,2)` | Suma de posiciones en ARS (USD convertidas por CCL). |
| `totalValueUsd` | `Decimal(18,2)?` | `totalValueArs / ccl`. |
| `ccl` | `Decimal(10,4)?` | CCL usado ese día. |
| `sourceFile` | `String?` | Nombre del CSV importado. |
| `positions` | `Position[]` | |
| `createdAt` | `DateTime @default(now())` | |
| `userId` / `user` | `String?` / `User?` | Ownership opcional. |

Restricciones: `@@unique([userId, snapshotDate])` (una fecha, un snapshot por usuario), `@@index([snapshotDate])`.

### `Position` → `positions`

Tenencia de un activo dentro de un snapshot.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `snapshotId` / `snapshot` | FK a `PortfolioSnapshot` (`onDelete: Cascade`) | |
| `ticker` | `String` | |
| `instrumentName` | `String?` | Nombre del instrumento. |
| `quantity` | `Decimal(18,8)` | |
| `price` | `Decimal(18,4)` | Precio unitario en la moneda indicada. |
| `currency` | `Currency @default(ARS)` | |
| `positionValue` | `Decimal(18,2)` | `quantity × price`. |
| `allocationPct` | `Decimal(8,6)` | **Fracción 0–1**, desnormalizada para reproducibilidad histórica. |
| `createdAt` | `DateTime @default(now())` | |

Restricciones: `@@unique([snapshotId, ticker])`, índices por `snapshotId` y `ticker`.

### `Asset` → `assets`

Catálogo de referencia **mutable** de CEDEARs (sin FK desde `Position`).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `ticker` | `String @unique` | |
| `instrumentName` | `String?` | |
| `cedearRatio` | `Decimal(8,4)` | CEDEARs por acción subyacente. |
| `description` | `String?` | |
| `sector` / `industry` / `country` | `String?` | Metadatos para análisis de concentración. |
| `underlyingTicker` | `String?` | Símbolo en NYSE/NASDAQ para Yahoo. |
| `assetKind` | `AssetKind @default(CEDEAR)` | `CEDEAR`, `FCI` u `OTHER`. Los fondos de Cocos (COCORMA/COCOUSDPA) son `FCI`. |
| `createdAt` / `updatedAt` | `DateTime` | |

### `ExchangeRate` → `exchange_rates`

Historial de CCL por fecha (global, sin `userId`).

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `date` | `DateTime @unique @db.Date` | |
| `ccl` | `Decimal(10,4)` | |
| `source` | `String?` | `dolarapi.com` o `argentinadatos.com`. |
| `createdAt` | `DateTime @default(now())` | |

### `MarketPriceCache` → `market_price_cache`

Último precio de mercado por ticker subyacente (global).

`id`, `ticker @unique`, `price Decimal(18,4)`, `currency Currency @default(USD)`, `fetchedAt DateTime @default(now())`, índice por `ticker`.

### `HistoricalPriceCache` → `historical_price_cache`

Precio **histórico diario en USD** por ticker subyacente, usado para la ganancia real.

`id`, `ticker`, `date @db.Date`, `priceUsd Decimal(18,4)`; `@@unique([ticker, date])`, índice por `ticker`.

### `BenchmarkPoint` → `benchmark_points`

Serie histórica de benchmarks externos.

`id`, `benchmarkId`, `date @db.Date`, `value Decimal(18,6)`; `@@unique([benchmarkId, date])`, índice compuesto.

---

## Operaciones

### `Transaction` → `transactions`

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `ticker` | `String` | |
| `type` | `TransactionType` | BUY / SELL. |
| `quantity` | `Decimal(18,8)` | |
| `price` | `Decimal(18,4)` | |
| `currency` | `Currency @default(ARS)` | |
| `fee` | `Decimal(18,2)?` | Comisión opcional. |
| `date` | `DateTime @db.Date` | |
| `notes` | `String?` | En importaciones de Cocos guarda `Cocos #<nroTicket>`. |
| `createdAt` | `DateTime @default(now())` | |
| `userId` / `user` | `String?` / `User?` | |
| `movementId` / `movement` | `String? @unique` / `Movement?` | Vínculo 1:1 con el movimiento de origen (null en cargas manuales). |

Índices por `ticker` y `date`.

### `Movement` → `movements`

**Libro de movimientos**: una fila por cada línea del CSV de movimientos de Cocos, ya categorizada. Es la fuente de verdad de la importación. Sólo las categorías `TRADE_BUY` / `TRADE_SELL` generan una `Transaction`; el resto (FCI, pagos, cobros, dividendos, conversiones) queda registrado pero no impacta el PPM.

| Campo | Tipo | Notas |
|---|---|---|
| `id` | `String @id @default(cuid())` | |
| `nroTicket` | `String` | ID de operación de Cocos. Clave de deduplicación. |
| `nroComprobante` | `String?` | |
| `date` | `DateTime @db.Date` | Fecha de ejecución. |
| `settlementDate` | `DateTime? @db.Date` | Fecha de liquidación. |
| `rawType` | `String` | `tipoOperacion` original del CSV. |
| `category` | `MovementCategory` | Categoría normalizada. |
| `instrument` | `String?` | Nombre completo del instrumento. |
| `ticker` | `String?` | Extraído del paréntesis (ej: `COCORMA`, `T661O`). |
| `currency` | `Currency @default(ARS)` | |
| `market` | `String?` | `BYMA` / `MAE`. |
| `quantity` | `Decimal(18,8)?` | |
| `price` | `Decimal(18,4)?` | |
| `grossAmount` | `Decimal(18,4)?` | `montoBruto`. |
| `commission` / `ddmm` / `iva` / `other` | `Decimal?` | Componentes de la comisión. |
| `total` | `Decimal(18,2)` | Importe neto. |
| `sourceFile` | `String?` | Archivo CSV importado. |
| `createdAt` | `DateTime @default(now())` | |
| `userId` / `user` | `String?` / `User?` | |
| `transaction` | `Transaction?` | Relación inversa 1:1. |

Restricciones: `@@unique([userId, nroTicket])` (importación idempotente), índices por `date`, `category` y `ticker`.

### `Dividend` → `dividends`

`id`, `ticker`, `amount Decimal(18,4)`, `currency Currency @default(USD)`, `date @db.Date`, `notes?`, `createdAt`, `userId?`/`user?`. Índices por `ticker` y `date`.

---

## Planificación y configuración

### `RetirementSettings` → `retirement_settings`

Un registro por usuario (se guarda con `findFirst`/`update`/`create`, no upsert por id fijo).

`id`, `currentAge Int`, `retirementAge Int`, `monthlyExpensesUsd Decimal(18,2)`, `inflationRate Decimal(6,4)`, `withdrawalRate Decimal(6,4)`, `monthlyContribution Decimal(18,2)`, `expectedReturnRate Decimal(6,4)` (retorno anual esperado en USD para la proyección, fracción; 0.07 por defecto), timestamps, `userId?`/`user?`.

### `MilestoneAlert` → `milestone_alerts`

`id`, `label`, `targetValueUsd Decimal(18,2)`, `reached Boolean @default(false)`, `reachedAt DateTime?`, `createdAt`, `userId?`/`user?`.

### `InvestmentStrategy` → `investment_strategies`

Estrategia de inversión **versionada e inmutable**; solo una activa.

`id`, `title`, `content String @db.Text` (system prompt), `isActive Boolean @default(false)`, `version Int`, timestamps. Índice por `isActive`.

### `PortfolioReport` → `portfolio_reports`

Reporte generado por Claude.

`id`, `fechaReporte String`, `rawText String` (respuesta del modelo), `normalizedJson Json` (reporte completo), `createdAt`, `userId?`/`user?`. Índice por `createdAt`. Desde ADR-0018 `normalizedJson` guarda el reporte de oportunidades con `version: 2` (señal por acción, `snapshot_fecha`, `posiciones_sin_datos` y `uso`: modelo, tokens y costo); los reportes anteriores, sin `version`, tienen el formato de asignaciones.

### `UserSetup` → `user_setup`

Metadata de presentación del onboarding (1:1 con `User`). La completitud de cada paso **no se guarda**: se deriva de los datos en `lib/setup-status.ts`.

| Campo | Tipo | Notas |
|---|---|---|
| `userId` | `String @id` (FK a `User`, `onDelete: Cascade`) | Relación 1:1. |
| `onboardingCompletedAt` | `DateTime?` | Wizard finalizado. |
| `onboardingDismissedAt` | `DateTime?` | Wizard omitido. |
| `lastStep` | `String?` | Paso para reanudar. |
| `createdAt` / `updatedAt` | `DateTime` | |

### `ExpenseTag` → `expense_tags`

Categoría y nota que el usuario le pone a un pago (`PAYMENT`) para ver en qué gasta (1:1 con `Movement`). Va aparte del libro de movimientos, que no se edita (ADR-0012).

| Campo | Tipo | Notas |
|---|---|---|
| `movementId` | `String @id` (FK a `Movement`, `onDelete: Cascade`) | El pago. |
| `userId` | `String` (FK a `User`, `onDelete: Cascade`) | Índice. |
| `category` | `String?` | Id de `EXPENSE_CATEGORIES` (`lib/expenses.ts`); `null` si solo tiene nota. |
| `note` | `String?` | Hasta 120 caracteres (p. ej. el comercio). |
| `updatedAt` | `DateTime @updatedAt` | |

### `AlertSettings` → `alert_settings`

Configuración de las alertas por mail (1:1 con `User`, ADR-0020).

| Campo | Tipo | Notas |
|---|---|---|
| `userId` | `String @id` (FK a `User`, `onDelete: Cascade`) | Relación 1:1. |
| `enabled` | `Boolean @default(false)` | El cron solo revisa a los usuarios activos. |
| `dropFromHighPct` | `Decimal(5,2) @default(15)` | Caída desde el máximo de 52 semanas, en %. |
| `weeklyDropPct` | `Decimal(5,2) @default(8)` | Caída en 5 ruedas, en %. |
| `reminderDay` | `Int @default(5)` | Día del mes desde el que se recuerda cargar el anterior. |
| `updatedAt` | `DateTime @updatedAt` | |

### `AlertLog` → `alert_logs`

Alertas enviadas, para no repetirlas todos los días: `id`, `userId` (FK, `onDelete: Cascade`), `kind AlertKind`, `key` (ticker o `AAAA-MM` del mes a cargar), `value Decimal(8,2)?` (caída desde el máximo al avisar, solo `PRICE_DROP`), `sentAt`. Índice `[userId, kind, key, sentAt]`.

---

## Relaciones (resumen)

```
User 1─* PortfolioSnapshot 1─* Position
User 1─* Transaction 1─1 Movement
User 1─* Movement
User 1─* Dividend
User 1─* MilestoneAlert
User 1─* RetirementSettings
User 1─* PortfolioReport
User 1─1 UserSetup
User 1─1 AlertSettings
User 1─* ExpenseTag  (Movement 1─1 ExpenseTag)
User 1─* AlertLog
User 1─* Session  /  Account

Asset (independiente, referencia por ticker)
ExchangeRate (independiente, por fecha)
MarketPriceCache / HistoricalPriceCache (independientes, por ticker)
BenchmarkPoint (independiente, por benchmarkId)
InvestmentStrategy (independiente, versionada)
```

Modelos **globales sin `userId`**: `Asset`, `ExchangeRate`, `MarketPriceCache`, `HistoricalPriceCache`, `BenchmarkPoint`, `InvestmentStrategy`.

---

## Migraciones

Ubicación: `prisma/migrations/`.

| Migración | Contenido |
|---|---|
| `20260308210347_init_portfolio_schema` | Esquema inicial del portafolio. |
| `20260309003921_add_market_features` | Precios de mercado, benchmarks, transacciones, dividendos, rebalanceo. |
| `20260309151439_add_auth_tables` | Tablas de Better Auth (`user`, `session`, `account`, `verification`). |
| `20260424000000_add_historical_price_cache` | Tabla `historical_price_cache`. |
| `20260522140000_add_user_role` | Columna `role` en `user`. |
| `20260522160000_add_asset_kind` | Enum `AssetKind` y columna `assetKind` en `assets`. |
| `20260920120000_add_movements_ledger` | Enum `MovementCategory`, tabla `movements` y `transactions.movementId`. |
| `20260920130000_target_allocation_per_user` | `TargetAllocation`: unique pasa de `ticker` a `[userId, ticker]`. |
| `20260921120000_add_user_setup` | Tabla `user_setup` (onboarding por usuario). |
| `20261009120000_add_alerts` | Enum `AlertKind`, tablas `alert_settings` y `alert_logs`. |
| `20261009180000_add_expense_tags` | Tabla `expense_tags`. |
| `20261009181000_expense_tag_optional_category` | `expense_tags.category` pasa a opcional. |
| `20261009220000_drop_target_allocations` | Borra la tabla `target_allocations` (sin pesos objetivo, ADR-0022). |
| `20261009200000_retirement_expected_return` | `retirement_settings.expectedReturnRate` (`Decimal(6,4)`, por defecto 0.07). |

Comandos (ver [desarrollo.md](./desarrollo.md)):

```bash
pnpm prisma migrate dev       # crear/aplicar migración en desarrollo
pnpm prisma migrate deploy    # aplicar en producción
pnpm prisma studio            # inspeccionar/editar datos
```

---

## Seed (`prisma/seed.ts`)

Se ejecuta con `pnpm db:seed` o `pnpm prisma db seed`. Crea su propio cliente `PrismaPg` (no reutiliza `lib/db.ts`).

1. **`seedInvestmentStrategy()`** — si no existe ninguna estrategia, crea `"Estrategia CEDEARs — Portafolio Jubilación (compacta)"`, `isActive: true`, `version: 1` con el contenido de `ESTRATEGIA_DEFAULT` (`lib/default-strategy.ts`). Para actualizar la estrategia activa en una base existente usar `pnpm db:strategy` (crea una nueva versión activa; es idempotente si el contenido no cambió).
2. **`seedAdminRoles()`** — lee `SEED_ADMIN_EMAIL` (emails separados por coma) y hace `updateMany` a `role = ADMIN` sobre usuarios existentes (no crea usuarios).
3. Captura `PrismaClientKnownRequestError` con código **P2021** (tablas faltantes) y sugiere correr migraciones.

### Scripts auxiliares (`scripts/`)

> `.gitignore` ignora `scripts/*` (para scripts sueltos) con excepciones explícitas para `refresh-strategy.ts` y `backfill-movements.ts`. `seed-admin.mjs` y `add-user-id-columns.mjs` están versionados desde antes de la regla. Un script nuevo que se quiera versionar necesita su línea `!scripts/<nombre>` en `.gitignore`.

- `seed-admin.mjs` — bootstrap de un admin hardcodeado (`admin@portfolio.com` / `Admin1234!`) con conexión `pg` directa y hash scrypt (`N=16384, r=16, p=1`, `dkLen=64`, formato `${saltHex}:${keyHex}`). También asocia datos huérfanos (`userId IS NULL`) al admin.
- `add-user-id-columns.mjs` — agrega columnas `userId` (FK a `user`) a las tablas de dominio mediante `ALTER TABLE ... IF NOT EXISTS`.
- `backfill-movements.ts` — crea un `Movement` por cada `Transaction` legacy (`notes = "Cocos #..."`) y la vincula. Ejecutar con `pnpm exec tsx scripts/backfill-movements.ts` una sola vez tras el refactor.
- `refresh-strategy.ts` — activa `ESTRATEGIA_DEFAULT` (`lib/default-strategy.ts`) como nueva versión de `InvestmentStrategy`. Se corre con `pnpm db:strategy`.
