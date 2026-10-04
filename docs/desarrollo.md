# Desarrollo y despliegue

## Requisitos

- Node.js 20+ (Next 16 / React 19).
- **pnpm 8** (fijado en `packageManager` de `package.json`: `pnpm@8.10.5`). Con corepack: `corepack enable` y pnpm toma esa versión. El proyecto se maneja solo con pnpm: no usar `npm install` (no hay `package-lock.json`).
- Una base PostgreSQL accesible.
- Clave de Anthropic (solo para el reporte mensual con IA).

## Puesta en marcha

```bash
# 1. Instalar dependencias (respeta pnpm-lock.yaml)
pnpm install

# 2. Crear .env con las variables necesarias
#    DATABASE_URL=postgresql://...
#    NEXT_PUBLIC_APP_URL=http://localhost:3000
#    ANTHROPIC_API_KEY=...            # opcional, para /portfolio
#    SEED_ADMIN_EMAIL=tu@email.com    # opcional, para el seed

# 3. Aplicar migraciones
pnpm prisma migrate dev        # desarrollo (crea archivos de migración)
pnpm prisma migrate deploy     # producción

# 4. Seed de estrategia y promoción de admin
pnpm db:seed

# 5. Levantar el servidor
pnpm dev                   # http://localhost:3000
```

El **registro público está cerrado por defecto**: `/register` redirige a `/login`. Para crear usuarios usá `scripts/seed-admin.mjs` o habilitá el alta con `ALLOW_PUBLIC_SIGNUP=true`. Los usuarios nuevos son `USER`; para acceder a las secciones de configuración hay que promoverlos a `ADMIN` (ver abajo).

---

## Scripts (`package.json`)

| Script | Comando | Descripción |
|---|---|---|
| `dev` | `next dev` | Servidor de desarrollo. |
| `build` | `next build` | Build de producción. |
| `start` | `next start` | Servidor de producción. |
| `lint` | `eslint` | Lint. |
| `test` | `vitest run` | Tests unitarios de la lógica pura de `lib/` (`*.test.ts`). |
| `test:watch` | `vitest` | Tests en modo watch. |
| `db:seed` | `tsx prisma/seed.ts` | Seed de estrategia + admins. |
| `db:strategy` | `tsx scripts/refresh-strategy.ts` | Activa la estrategia compacta de `lib/default-strategy.ts` como nueva versión (idempotente). |

Se corren como `pnpm <script>` (`pnpm db:seed`). Los binarios locales también se invocan con pnpm: `pnpm prisma …`, `pnpm vitest …`, `pnpm exec tsx <archivo>`. `tsx` es devDependency (no depende de `npx`).

`prisma.config.ts` también define `migrations.seed = "pnpm exec tsx prisma/seed.ts"`, usado por `prisma db seed`.

---

## Base de datos

- Cliente Prisma generado en `app/generated/prisma` (config en `schema.prisma`).
- Conexión con driver adapter `PrismaPg` y `ssl: { rejectUnauthorized: false }` (`lib/db.ts`), apto para Neon/Supabase.
- Comandos útiles:

```bash
pnpm prisma studio     # explorar y editar datos
pnpm prisma migrate dev --name <nombre>
pnpm prisma generate
```

### Historial de migraciones

La base de desarrollo tenía drift respecto de `prisma/migrations` (columnas `userId` y `assetKind` aplicadas fuera de migraciones). Se reconcilió de forma no destructiva:

- Se recreó `prisma/migrations/20260522160000_add_asset_kind/` con el DDL del enum `AssetKind` y la columna `assets.assetKind`.
- La migración `20260920120000_add_movements_ledger` se generó con `prisma migrate diff` y se aplicó con `prisma migrate deploy`.

Si en un entorno nuevo aparece drift, **no usar `prisma migrate reset`** (borra datos): generar el SQL con `pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` y aplicar con `prisma db execute` + `prisma migrate resolve --applied`.

### Hacer admin a un usuario

Opción recomendada (política en DB):

```sql
UPDATE "user" SET role = 'ADMIN' WHERE email = 'tu-email@ejemplo.com';
```

o con Prisma Studio. Alternativas de bootstrap:

- `pnpm db:seed` con `SEED_ADMIN_EMAIL` (solo promueve usuarios existentes).
- `node scripts/seed-admin.mjs` crea/setup del admin `admin@portfolio.com` con contraseña `Admin1234!` (hardcodeada; cambiar en producción) y asocia datos huérfanos.

---

## Variables de entorno

| Variable | Requerida | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión PostgreSQL. |
| `NEXT_PUBLIC_APP_URL` | Recomendada | Base URL del cliente Better Auth (fallback `http://localhost:3000`). |
| `BETTER_AUTH_SECRET` | Producción | Secreto de firma de sesiones (convención Better Auth). |
| `BETTER_AUTH_URL` | Producción | URL base del server de auth. |
| `ANTHROPIC_API_KEY` | Para `/portfolio` | Análisis con Claude. |
| `ANTHROPIC_MODEL` | Opcional | Modelo Claude (default `claude-sonnet-5`). |
| `ANTHROPIC_EFFORT` | Opcional | Nivel de razonamiento `low\|medium\|high\|max` (default `low`). |
| `ANTHROPIC_TIMEOUT_MS` | Opcional | Timeout del análisis en ms (default y máximo `290000`, por debajo de `maxDuration`). |
| `SEED_ADMIN_EMAIL` | Opcional | Emails (coma-separados) a promover en el seed. |
| `ALLOW_PUBLIC_SIGNUP` | Opcional | `true` reactiva el registro público en `/register` (por defecto cerrado). |

---

## Convenciones de código

Definidas en `.cursor/rules.md`:

- **App Router exclusivamente.** RSC para páginas, fetch directo en `page.tsx`; `"use client"` solo cuando se necesita estado o eventos.
- **Server Actions para mutaciones** en `app/actions/` (un archivo por dominio). Devolver uniones `{ success: true, ... } | { success: false, error }`.
- **API routes** solo para binarios (PDF/CSV/HTML) o integración externa.
- **Params async** en Next 16: `const { id } = await params;`.
- **`lib/` sin Prisma**, salvo los helpers de lectura `portfolio-data.ts`, `analysis-data.ts`, `real-gains-data.ts`.
- **Decimal → Number(...)** explícito al exponer valores.
- **Nunca** sobrescribir snapshots ni el CCL histórico registrado.
- **Sin `console.log`** en código de producción; comentarios que expliquen el *por qué*.
- UI: usar shadcn/ui, `SiteHeader` para headers, `ChartContainer` para gráficos, `Intl.*` con locale `"es-AR"`, `key` estables en listas.
- Roles: `lib/user-role.ts` (`isAdminRole`); los items admin van bajo `NAV_CONFIG` en el sidebar y deben coincidir con `ADMIN_PATH_PREFIXES` del proxy (`proxy.ts`).
- **Datos de usuario:** toda lectura/borrado filtra por `userId` (`requireUserId()`); después de mutar, revalidar con los helpers de `lib/revalidate.ts`.
- **Lógica nueva** (cálculos, parsers): función pura en `lib/` + `*.test.ts` al lado.
- **Decisiones de arquitectura:** si un cambio contradice o reemplaza algo registrado en [`adr/`](./adr/README.md), agregar un ADR nuevo (y marcar el anterior como *Reemplazado*) en lugar de editar el viejo.

---

## Flujo de trabajo típico

```bash
# desarrollo
pnpm dev

# validar antes de commitear (mismo orden que el CI)
pnpm lint
pnpm test                                        # o un archivo: pnpm vitest run lib/dca-planner.test.ts
pnpm build

# cambios de esquema
# editar prisma/schema.prisma
pnpm prisma migrate dev --name add_x
pnpm db:seed
```

---

## Despliegue

- Aplicación pensada para Vercel (la IA y los exports server-side usan API routes; el sistema de archivos es efímero, por eso los reportes se guardan en `PortfolioReport`).
- Pasos típicos: configurar variables de entorno → `prisma migrate deploy` → `next build`.
- El proxy (`proxy.ts`) corre en runtime Node.js por defecto, por lo que el entorno de despliegue debe soportarlo.

---

## Notas y deuda técnica

### Repositorio y CI

- **Fixtures reales vs sintéticos:** `__fixtures__/` (CSV reales de la cuenta) está ignorado. `lib/cocos-movements.test.ts` usa un CSV sintético embebido que cubre cada tipo de operación; los tests contra los archivos reales son una regresión local que se saltea (`describe.skipIf`) cuando no están, como en CI.
- **Scripts:** `scripts/*` está ignorado salvo las excepciones explícitas en `.gitignore`. Un script nuevo que se use desde `package.json` o la doc necesita su línea `!scripts/<nombre>`.
- Las exportaciones reales de la cuenta en `docs/movimientos/*.csv` y `docs/portfolio_report/` están ignoradas: no versionarlas.
- **Gestor de paquetes: solo pnpm.** El CI instala con `pnpm install --frozen-lockfile`: si `package.json` cambia sin actualizar `pnpm-lock.yaml`, falla. Agregar dependencias siempre con `pnpm add` (o `pnpm add -D`).
- `xlsx` y `@types/xlsx` siguen en `dependencies` pero ya no se importan en ningún archivo (quedaron de la importación XLSX que se eliminó).

### Seguridad

- Las actions de refresco de mercado (`exchange-rate`, `market-prices`, `historical-prices`, `benchmarks`, `indices`) no validan sesión dentro de la action (dependen del proxy); solo escriben caches globales de datos públicos.
- `scripts/seed-admin.mjs` tiene la contraseña `Admin1234!` hardcodeada.

### Integraciones

- Los precios de Sonnet 5 para el costo estimado están hardcodeados en el route; cambiar `ANTHROPIC_MODEL` hace que el costo informado sea incorrecto.
- **Sin timeouts** en `lib/yahoo-finance-client.ts` ni en los fetch a dolarapi/argentinadatos.
- **Caché de auth de Yahoo** de 23 h sin reintento de re-auth ante 401.

### Código

- **`getPreviousSnapshot` y `getSnapshotCount`** (`lib/portfolio-data.ts`) no tienen consumidores.
- **Tolerancias documentadas vs código:** el `missingReason` de ganancia real (`lib/real-gains-data.ts`) dice "±3 días" para el precio histórico, pero `PRICE_TOLERANCE_DAYS = 5`.
- **Monte Carlo** usa volatilidad mensual fija (4%) independiente de los inputs.
- Los CSV exportados no incluyen BOM UTF-8; las rutas de export no tienen `try/catch` alrededor de la DB.
- `/portfolio` no usa `SiteHeader` (excepción a la convención de UI).

> **Resuelto:**
> - El aislamiento por ownership (deletes, reportes y API routes de export filtran por `userId`), el registro público cerrado por defecto y `PortfolioReport` con `userId`.
> - Los tests ya no fallan en un checkout limpio: CSV sintético embebido + regresión con archivos reales salteada si faltan.
> - Las actions de `strategy.ts` exigen rol ADMIN (`requireAdmin()` en `lib/auth-session.ts`, compartido con `assets.ts`) y `POST /api/analyze-portfolio` responde `403` a no-admins.
> - El timeout del análisis se acota a 290 s para vencer antes de `maxDuration` (300 s).
> - `scripts/refresh-strategy.ts` y `backfill-movements.ts` versionados (`pnpm db:strategy` funciona en un clone nuevo); los CSV reales de `docs/` ignorados.
> - El CI nunca había pasado: corría `npm install` sobre un `package-lock.json` abandonado (sin `vitest`) y npm cortaba por el peer `vitest@^2–4` de `better-auth`. Ahora todo se maneja con pnpm (`packageManager`, CI con `--frozen-lockfile`) y se eliminó `package-lock.json`.

---

## Documentación relacionada

- [README.md](./README.md) — índice general.
- [arquitectura.md](./arquitectura.md) — stack, capas, auth, roles.
- [modelo-de-datos.md](./modelo-de-datos.md) — schema Prisma.
- [flujo-de-uso.md](./flujo-de-uso.md) — flujo operativo mensual.
- [datos-del-portfolio.md](./datos-del-portfolio.md) — métricas por pantalla.
- [adr/](./adr/README.md) — registro de decisiones de arquitectura.
