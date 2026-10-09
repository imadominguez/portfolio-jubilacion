# Desarrollo y despliegue

## Requisitos

- Node.js 20+ (Next 16 / React 19).
- **pnpm 8** (fijado en `packageManager` de `package.json`: `pnpm@8.10.5`). Con corepack: `corepack enable` y pnpm toma esa versión. El proyecto se maneja solo con pnpm: no usar `npm install` (no hay `package-lock.json`).
- Una base PostgreSQL accesible.
- Clave de Anthropic (solo para el reporte de oportunidades con IA en `/portfolio`).

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
| `NEXT_PUBLIC_APP_URL` | Recomendada | Base URL del cliente Better Auth (sin definir, usa el origen de la página). |
| `BETTER_AUTH_SECRET` | Producción | Secreto de firma de sesiones (convención Better Auth). |
| `BETTER_AUTH_URL` | Producción | URL base del server de auth. |
| `ANTHROPIC_API_KEY` | Para `/portfolio` | Análisis con Claude. |
| `ANTHROPIC_MODEL` | Opcional | Modelo Claude (default `claude-sonnet-5-5`). El costo se calcula con los precios de `MODEL_PRICING` (`lib/opportunity-report.ts`): un modelo que no esté ahí informa costo nulo. |
| `ANTHROPIC_EFFORT` | Opcional | Nivel de razonamiento `low\|medium\|high\|xhigh\|max` (default `low`). Solo se manda a los modelos que lo aceptan (`modelRequestOptions`); con Haiku 4.5 no se usa. |
| `ANTHROPIC_TIMEOUT_MS` | Opcional | Timeout del análisis en ms (default y máximo `290000`, por debajo de `maxDuration`). |
| `SEED_ADMIN_EMAIL` | Opcional | Emails (coma-separados) a promover en el seed. |
| `ALLOW_PUBLIC_SIGNUP` | Opcional | `true` reactiva el registro público en `/register` (por defecto cerrado). |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Para las alertas | Cuenta de Gmail y contraseña de aplicación con las que se mandan las alertas (`lib/mailer.ts`). |
| `CRON_SECRET` | Producción | Secreto que Vercel Cron manda en `Authorization: Bearer …` a `/api/cron/alerts`. |

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
- **Datos de usuario:** toda lectura/borrado filtra por `userId` (`requireUserId()`); después de mutar, invalidar con los helpers de `lib/revalidate.ts` (`updateTag` del dominio, ver [server-actions.md](./server-actions.md)).
- **Lógica nueva** (cálculos, parsers): función pura en `lib/` + `*.test.ts` al lado.
- **Decisiones de arquitectura:** si un cambio contradice o reemplaza algo registrado en [`adr/`](./adr/README.md), agregar un ADR nuevo (y marcar el anterior como *Reemplazado*) en lugar de editar el viejo.
- **Cache Components** (Next 16.3, [ADR-0017](./adr/0017-cache-components-partial-prerendering-y-prefetching.md)): la sesión, `cookies()`, `headers()`, `params` y `searchParams` se leen dentro de un componente envuelto en `<Suspense>`, nunca en el top-level de un layout o página. Los datos se cachean con `'use cache'` + `cacheLife` + `cacheTag`. Ninguna ruta usa `export const instant = false`; no agregarlo salvo una razón documentada.

### Cache Components y el MCP de Next.js

- La documentación de la versión instalada está en `node_modules/next/dist/docs/` (usar esa, no la de memoria).
- Validación: `pnpm build` muestra los errores que bloquean el build y la tabla de rutas (`◐` = Partial Prerender, `ƒ` = dinámica). Las validaciones de **navegación instantánea** aparecen solo en dev (overlay y log de `pnpm dev`). Para depurar un prerender: `pnpm exec next build --debug-prerender`.
- **Qué entra en el static shell** de una ruta: después de `pnpm build`, revisar `.next/server/app/<ruta>.html`. Lo que está antes del primer `<!--$?--><template id="B:…">` es lo que se pinta primero; el contenido diferido llega en `<div hidden id="S:…">`.
- **`loading.tsx`** envuelve a todas las rutas que cuelgan de su carpeta y su fallback queda en el static shell de cada una. Por eso el del Dashboard vive en el grupo `app/(app)/(dashboard)/` y no en `app/(app)/`. Como cada ruta tiene `loading.tsx`, la validación de navegación instantánea casi nunca avisa: para juzgar el shell, mirar el HTML del build.
- **MCP oficial** (`.mcp.json`, `next-devtools-mcp`): con `pnpm dev` corriendo, el agente consulta `get_errors`, `get_routes`, `get_page_metadata`, `get_compilation_issues`, etc. Hay que aprobar el servidor del proyecto la primera vez que se abre Claude Code. Si el cliente no conecta (con `pnpm dlx` la descarga puede superar el timeout de 30 s), el mismo MCP está en el dev server: `POST http://localhost:<puerto>/_next/mcp` con JSON-RPC (`{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"get_errors","arguments":{}}}` y `Accept: application/json, text/event-stream`).

### Estado de la adopción de Cache Components

Adopción completa (2026-10-07), una PR por feature ([ADR-0017](./adr/0017-cache-components-partial-prerendering-y-prefetching.md)):

| PR | Contenido |
|---|---|
| #3 | Pre-paso: `cacheComponents` + `partialPrefetching`, codemod `instant = false`, fuentes self-hosted |
| #4 | Layout `(app)`, sidebar (grupo admin en `<Suspense>`), Dashboard, `getSession()` con `'use cache: private'` |
| #5 | Caché de datos por usuario/dominio (`lib/cache-tags.ts`) e invalidación con `updateTag` (`lib/revalidate.ts`) |
| #6 | `/guia`: quita el opt-out (se prerenderiza entera), rediseño responsive de la guía y fix del cliente de auth en otro puerto |
| #7 | `/ccl`; `getAllExchangeRates` cacheado con el tag `ccl` |
| #8 | `/portfolio` (sin lecturas en el servidor), `/login` y `/register` con `AuthCardSkeleton` como fallback |
| #9 | `/snapshots`, `/settings`, `/retirement`, `/analysis` (lecturas ya cacheadas); `key` en `MilestonesClient` por `<Activity>` |
| #10 | `/plan` y `/rebalance`; `getTargetAllocations` cacheado con el tag `rebalance:<userId>` |
| #11 | `/transactions`; `getAllTransactions`, `getRealizedPnl`, `getMovements` (tag `trades`) y `getAllDividends` (tag `dividends`) cacheados |
| #12 | `/performance`; `getBenchmarkPoints` (y `getIndexPoints`, que delega) cacheado con el tag `benchmarks` |
| #13 | `/real-gains` (botón del header en su propio `<Suspense>`) y `/datos` (Suspense finos por sección/tarjeta); `getDataReadiness` cacheado |
| #14 | `/assets` (`getAssetCatalog`, tag `assets`) y `/strategy` (tag `strategy`), con `requireAdmin()` fuera del caché; `key` en `StrategyEditor` |
| #15 | `/snapshots/[id]` (`getSnapshotById` cacheado, `prefetch={true}` desde el listado) y adaptador de navegación del tour sin `usePathname()` en el render |
| #20 | Dashboard en el grupo `(dashboard)`: su skeleton deja de aparecer en el shell de las demás rutas (−9 a −15 KB por ruta) |

**Cómo agregar una ruta nueva** (mismo patrón que el resto, p. ej. `app/(app)/ccl/page.tsx`):

1. La página es síncrona: el `SiteHeader` (y el texto estático) queda en la página y va al shell; las lecturas van en un componente async dentro de `<Suspense>`, con un skeleton en `components/<dominio>/*-skeleton.tsx` que también usa su `loading.tsx`. Si el header depende de datos (acciones o descripción), esa parte va en su propio `<Suspense>`.
2. Cada lectura nueva se cachea: getter exportado que resuelve el usuario (o el rol) + función no exportada con `'use cache'`, `cacheLife("hours")` y un tag por dominio leído. Las globales sin datos de request llevan `await connection()` antes. Ver la tabla de tags en [server-actions.md](./server-actions.md).
3. Cada escritura llama al helper de su dominio en `lib/revalidate.ts` (agregarlo si no existe).
4. Si un cliente copia props a su estado (`useState(initial…)`), `<Activity>` lo conserva entre navegaciones: darle un `key` derivado de los datos.
5. Validar: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm test`, `pnpm build` (también con las variables falsas del CI), el HTML del shell en `.next/server/app/` y la ruta en dev con el MCP (`get_errors`).

**Si una escritura no se refleja al instante:** revisar que la action llame al helper de `lib/revalidate.ts` del dominio que escribe y que la lectura cacheada declare ese tag.

**Para validar en el navegador** con `agent-browser`: el proyecto suele correr en el puerto 3001 (otro proyecto ocupa el 3000); perfil de vault `portfolio-3001` (`agent-browser auth login portfolio-3001`; el perfil `portfolio` es del 3000). El vault no completa el email: cargarlo a mano en `input[type=email]`. Nunca leer el HTML ni los valores de un formulario de login completo (expondría la contraseña). Con `<Activity>` quedan copias ocultas de páginas anteriores en el DOM: en clicks por JavaScript, filtrar elementos visibles (`offsetParent !== null`).

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

> Después de `pnpm prisma generate` (o de un `migrate` que lo dispara) hay que **reiniciar `pnpm dev`**: el dev server sigue con el cliente viejo y falla al compilar ("Jest worker encountered 2 child process exceptions") o al leer los modelos nuevos.
>
> Si `migrate dev` detecta drift, no usar `migrate reset`: generar la migración con `pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script > prisma/migrations/<fecha>_<nombre>/migration.sql` y aplicarla con `pnpm prisma migrate deploy` (es lo que se hizo con las migraciones de alertas y gastos).

---

## Despliegue

- Aplicación pensada para Vercel (la IA y los exports server-side usan API routes; el sistema de archivos es efímero, por eso los reportes se guardan en `PortfolioReport`).
- Pasos típicos: configurar variables de entorno → `prisma migrate deploy` → `next build`. El build de Vercel **no** corre migraciones: una migración nueva se aplica a mano (`pnpm prisma migrate deploy`) antes de mergear el código que la usa.
- **Cron:** `vercel.json` programa `/api/cron/alerts` todos los días a las 12:00 UTC. Vercel manda `CRON_SECRET` en `Authorization`; el valor no puede tener espacios ni saltos de línea al principio o al final (el build falla). Para generarlo en Windows sin el `\r\n` de `openssl`: `openssl rand -hex 32 | tr -cd '0-9a-f'`.
- Las variables de entorno nuevas solo llegan a producción con un deploy nuevo (`vercel redeploy <url> --target production` o un merge a `main`).
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

### Código

- **`getPreviousSnapshot` y `getSnapshotCount`** (`lib/portfolio-data.ts`) no tienen consumidores.
- **Tolerancias documentadas vs código:** el `missingReason` de ganancia real (`lib/real-gains-data.ts`) dice "±3 días" para el precio histórico, pero `PRICE_TOLERANCE_DAYS = 5`.
- **Monte Carlo** usa volatilidad mensual fija (4%) independiente de los inputs.
- Los CSV exportados (salvo el de impuestos) no incluyen BOM UTF-8; las rutas de export de snapshot y transacciones no tienen `try/catch` alrededor de la DB.
- **Bonos y ONs:** Cocos da el precio cada 100 nominales, así que el listado de transacciones y `calculatePPM` calculan cantidad × precio 100 veces más grande. El reporte de impuestos usa el bruto del movimiento; el resto todavía no.
- **Ventas con cantidad negativa:** las importadas antes de normalizar el signo se leen con `Math.abs`; se podrían corregir en la base con un `UPDATE` sobre `transactions` (type `SELL`, quantity < 0).
- `/portfolio` no usa `SiteHeader` (excepción a la convención de UI).
- **Sin tests end-to-end.** La guía de Next sugiere un test `instant()` (`@next/playwright`) por ruta para que el static shell no se degrade sin que nadie lo note.
- `checkAndUpdateMilestones` es una Server Action exportada que recibe el valor en USD desde el llamador: un usuario logueado podría invocarla con un valor arbitrario y marcar sus propios hitos como alcanzados (solo afecta sus datos).
- **MCP de Next:** `.mcp.json` usa `pnpm dlx next-devtools-mcp@latest`, que descarga el paquete en cada arranque y suele superar el timeout de conexión de 30 s. Mientras tanto se puede usar `/_next/mcp` del dev server (ver arriba).

> **Resuelto:**
> - El aislamiento por ownership (deletes, reportes y API routes de export filtran por `userId`), el registro público cerrado por defecto y `PortfolioReport` con `userId`.
> - Los tests ya no fallan en un checkout limpio: CSV sintético embebido + regresión con archivos reales salteada si faltan.
> - Las actions de `strategy.ts` exigen rol ADMIN (`requireAdmin()` en `lib/auth-session.ts`, compartido con `assets.ts`) y `POST /api/analyze-portfolio` responde `403` a no-admins.
> - El timeout del análisis se acota a 290 s para vencer antes de `maxDuration` (300 s).
> - `scripts/refresh-strategy.ts` y `backfill-movements.ts` versionados (`pnpm db:strategy` funciona en un clone nuevo); los CSV reales de `docs/` ignorados.
> - El CI nunca había pasado: corría `npm install` sobre un `package-lock.json` abandonado (sin `vitest`) y npm cortaba por el peer `vitest@^2–4` de `better-auth`. Ahora todo se maneja con pnpm (`packageManager`, CI con `--frozen-lockfile`) y se eliminó `package-lock.json`.
> - Las llamadas a Yahoo Finance, dolarapi y argentinadatos tienen timeout (`fetchWithTimeout`, `lib/http.ts`, 15 s) y el cliente de Yahoo renueva la sesión y reintenta una vez ante 401/403.
> - `getMilestones` es solo lectura: los hitos por defecto se crean al importar el primer snapshot (antes se creaban dentro de la lectura cacheada y volvían si el usuario los borraba todos).
> - El reporte con IA dejó de usar precios fijos de Sonnet 5: el costo se calcula con el modelo que respondió y se guarda en cada reporte, que ahora cuesta unos centavos (primera medición: US$ 0,0656; ADR-0018).

---

## Documentación relacionada

- [README.md](./README.md) — índice general.
- [arquitectura.md](./arquitectura.md) — stack, capas, auth, roles.
- [modelo-de-datos.md](./modelo-de-datos.md) — schema Prisma.
- [flujo-de-uso.md](./flujo-de-uso.md) — flujo operativo mensual.
- [datos-del-portfolio.md](./datos-del-portfolio.md) — métricas por pantalla.
- [adr/](./adr/README.md) — registro de decisiones de arquitectura.
