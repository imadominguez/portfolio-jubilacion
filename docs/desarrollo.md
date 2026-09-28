# Desarrollo y despliegue

## Requisitos

- Node.js 20+ (Next 16 / React 19).
- Una base PostgreSQL accesible.
- Clave de Anthropic (solo para el reporte mensual con IA).

## Puesta en marcha

```bash
# 1. Instalar dependencias (hay package-lock.json y pnpm-lock.yaml)
npm install

# 2. Crear .env con las variables necesarias
#    DATABASE_URL=postgresql://...
#    NEXT_PUBLIC_APP_URL=http://localhost:3000
#    ANTHROPIC_API_KEY=...            # opcional, para /portfolio
#    SEED_ADMIN_EMAIL=tu@email.com    # opcional, para el seed

# 3. Aplicar migraciones
npx prisma migrate dev        # desarrollo (crea archivos de migración)
npx prisma migrate deploy     # producción

# 4. Seed de estrategia y promoción de admin
npm run db:seed

# 5. Levantar el servidor
npm run dev                   # http://localhost:3000
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
| `test` | `vitest run` | Tests unitarios (parser de movimientos). |
| `test:watch` | `vitest` | Tests en modo watch. |
| `db:seed` | `npx tsx prisma/seed.ts` | Seed de estrategia + admins. |
| `db:strategy` | `npx tsx scripts/refresh-strategy.ts` | Activa la estrategia compacta de `lib/default-strategy.ts` como nueva versión (idempotente). |

`prisma.config.ts` también define `migrations.seed = "npx tsx prisma/seed.ts"`, usado por `prisma db seed`.

---

## Base de datos

- Cliente Prisma generado en `app/generated/prisma` (config en `schema.prisma`).
- Conexión con driver adapter `PrismaPg` y `ssl: { rejectUnauthorized: false }` (`lib/db.ts`), apto para Neon/Supabase.
- Comandos útiles:

```bash
npx prisma studio     # explorar y editar datos
npx prisma migrate dev --name <nombre>
npx prisma generate
```

### Historial de migraciones

La base de desarrollo tenía drift respecto de `prisma/migrations` (columnas `userId` y `assetKind` aplicadas fuera de migraciones). Se reconcilió de forma no destructiva:

- Se recreó `prisma/migrations/20260522160000_add_asset_kind/` con el DDL del enum `AssetKind` y la columna `assets.assetKind`.
- La migración `20260920120000_add_movements_ledger` se generó con `prisma migrate diff` y se aplicó con `prisma migrate deploy`.

Si en un entorno nuevo aparece drift, **no usar `prisma migrate reset`** (borra datos): generar el SQL con `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` y aplicar con `prisma db execute` + `prisma migrate resolve --applied`.

### Hacer admin a un usuario

Opción recomendada (política en DB):

```sql
UPDATE "user" SET role = 'ADMIN' WHERE email = 'tu-email@ejemplo.com';
```

o con Prisma Studio. Alternativas de bootstrap:

- `npm run db:seed` con `SEED_ADMIN_EMAIL` (solo promueve usuarios existentes).
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
| `ANTHROPIC_TIMEOUT_MS` | Opcional | Timeout del análisis en ms (default `900000`). |
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

---

## Flujo de trabajo típico

```bash
# desarrollo
npm run dev

# validar antes de commitear
npm run lint
npm run build

# cambios de esquema
# editar prisma/schema.prisma
npx prisma migrate dev --name add_x
npm run db:seed
```

---

## Despliegue

- Aplicación pensada para Vercel (la IA y los exports server-side usan API routes; el sistema de archivos es efímero, por eso los reportes se guardan en `PortfolioReport`).
- Pasos típicos: configurar variables de entorno → `prisma migrate deploy` → `next build`.
- El proxy (`proxy.ts`) corre en runtime Node.js por defecto, por lo que el entorno de despliegue debe soportarlo.

---

## Notas y deuda técnica

- **Sin timeouts** en `lib/yahoo-finance-client.ts` ni en los fetch a dolarapi/argentinadatos.
- **Caché de auth de Yahoo** de 23 h sin reintento de re-auth ante 401.
- **`getPreviousSnapshot` y `getSnapshotCount`** no tienen consumidores detectados.
- **Tolerancias documentadas vs código:** el mensaje de ganancia real menciona ±3 días para precio histórico, pero el código usa 5.
- **Monte Carlo** usa volatilidad mensual fija (4%) independiente de los inputs.
- Los CSV exportados no incluyen BOM UTF-8.

> **Resuelto:** el aislamiento por ownership (deletes y API routes de export filtran por `userId`), el registro público cerrado por defecto y `PortfolioReport` ahora guarda `userId`.

---

## Documentación relacionada

- [README.md](./README.md) — índice general.
- [arquitectura.md](./arquitectura.md) — stack, capas, auth, roles.
- [modelo-de-datos.md](./modelo-de-datos.md) — schema Prisma.
- [flujo-de-uso.md](./flujo-de-uso.md) — flujo operativo mensual.
- [datos-del-portfolio.md](./datos-del-portfolio.md) — métricas por pantalla.
