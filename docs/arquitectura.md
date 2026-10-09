# Arquitectura

## Stack tecnológico

| Capa | Tecnología |
|---|---|
| Framework | Next.js `16.3.8` (App Router, React Server Components, **Cache Components** con Partial Prerendering; ver [ADR-0017](./adr/0017-cache-components-partial-prerendering-y-prefetching.md)) |
| UI | React `19.2.3`, shadcn/ui (`style: radix-nova`), Tailwind CSS v4, `radix-ui`, `@base-ui/react` |
| Gráficos | Recharts `2.15` (vía `ChartContainer` de shadcn) |
| Auth | Better Auth `1.6` (email + password, sesiones en cookie) |
| ORM / DB | Prisma `7.4` + PostgreSQL, driver adapter `@prisma/adapter-pg` |
| Mutaciones | Server Actions (`app/actions/`) |
| Export | `@react-pdf/renderer` `4.5`, CSV/HTML generados en API routes |
| IA | Anthropic API con el SDK oficial (`claude-sonnet-5-5`, configurable con `ANTHROPIC_MODEL`) y structured outputs |
| Onboarding | `nextstepjs` `2.2` (transpilado en `next.config.ts`) |
| Otros | `date-fns`, `xlsx`, `react-dropzone`, `react-day-picker`, `sonner`, `next-themes`, `lucide-react`, `motion`, `cmdk`, `vaul` |

**Runtime:** el proxy (`proxy.ts`) corre siempre en runtime Node.js (no configurable), necesario para Prisma/Better Auth.

---

## Estructura de carpetas

```
app/
  layout.tsx                    Layout raíz: fuentes, ThemeProvider (dark por defecto), Toaster
  globals.css                   Tailwind v4 + tokens de tema (OKLCH), animaciones, estilos de tour
  (auth)/
    login/                      page.tsx (lee searchParams dentro de <Suspense>) + login-form.tsx (client)
    register/                   page.tsx redirige a /login salvo ALLOW_PUBLIC_SIGNUP=true + register-form.tsx
    error.tsx                   Error boundary de auth
  (app)/                        Zona autenticada con sidebar
    layout.tsx                  Síncrono (static shell): Onboarding/Tooltip/Sidebar; el grupo admin va en <Suspense>
    error.tsx / not-found.tsx   Error boundary y 404 compartidos; cada ruta tiene su loading.tsx
    (dashboard)/                Grupo solo para que su loading.tsx aplique únicamente a /
      page.tsx + loading.tsx    Dashboard (/)
    plan/                       Plan DCA determinista del mes
    performance/                TIR, TWR, drawdown, benchmarks
    ccl/                        Historial CCL
    snapshots/                  Listado + [id] detalle
    analysis/                   Concentración
    rebalance/                  Objetivo vs real
    transactions/               Gastos del mes, compras/ventas, PPM, dividendos
    retirement/                 Calculadora de retiro + Monte Carlo
    real-gains/                 Ganancia real USD vs impacto CCL
    flujo/                      Flujo de caja: depósitos, gastos, ahorro e inversión por mes
    impuestos/                  Tenencia al cierre, ventas y dividendos del año
    alertas/                    Configuración e historial de alertas por mail
    assets/                     Catálogo de CEDEARs           (ADMIN)
    strategy/                   System prompt versionado       (ADMIN)
    settings/                   Hitos                          (ADMIN)
    portfolio/                  Oportunidades por acción (IA)  (ADMIN)
    guia/                       Guía Cocos
    datos/                      Centro de Datos (hub de importación)
  actions/                      Server Actions (una por dominio)
  api/
    auth/[...all]/              Handler catch-all de Better Auth
    analyze-portfolio/          POST: reporte de oportunidades con Claude
    export/
      pdf/[snapshotId]/         PDF server-side
      snapshot/[id]/            CSV (format=csv) o HTML imprimible
      transactions/             CSV de transacciones
      impuestos/                CSV del reporte para impuestos (?anio=)
    cron/alerts/                GET: alertas diarias (Vercel Cron, CRON_SECRET)
  generated/prisma/             Cliente Prisma generado (no editar a mano)
components/
  layout/                       AppSidebar, SiteHeader, CommandMenu
  dashboard/                    Hero, KpiStrip, AnalysisTools, HoldingsTable, AllocationPanel, PerformersPanel, MilestoneWidget, chart widget, empty
  performance/                  PerformanceChart, BenchmarkOverlayChart, InflationChart
  plan/                         DcaPlannerClient
  analysis/                     ConcentrationCharts, OpportunityAnalyzer, OpportunityReportDisplay, ReportHistorial, legacy-report
  assets/                       AssetDialog, AssetsTableClient
  snapshots/                    ImportCsvSheet, ImportButton
  transactions/                 ExpensesSection (gastos del mes), ExpensesTable, ExpensesDailyChart, TransactionsClient, TransactionForm, DividendForm, ImportMovimientosButton
  taxes/                        TaxReportView, TaxReportSkeleton (/impuestos)
  cash-flow/                    CashFlowChart, CashFlowSkeleton (/flujo)
  alerts/                       AlertSettingsForm, AlertsSkeleton (/alertas)
  rebalance/                    RebalanceClient
  retirement/                   RetirementClient
  strategy/                     StrategyEditor
  settings/                     MilestonesClient
  real-gains/                   RealGainsWizard, RealGainsUpdateButton, KpiCard, BreakdownBar, PositionsTable, MethodologyNote
  ccl/  exchange-rate/  market/ chart + botones de actualización (CCL, precios, índices)
  export/                       ExportButtons, CsvExportButton, portfolio-pdf
  onboarding/                   Provider, card, trigger y sincronizadores de tour
  setup/                        Wizard de bienvenida, checklist de puesta en marcha y orquestador
  guide/                        CocosGuide
  ui/                           Componentes shadcn (no editar salvo necesidad)
lib/
  db.ts                         Singleton de Prisma (adapter pg)
  auth.ts                       Config Better Auth (server)
  auth-client.ts                Cliente Better Auth (browser)
  auth-session.ts               getSession / requireAuth / requireUserId / requireAdmin
  user-role.ts                  isAdminRole / ADMIN_ROLE
  portfolio-data.ts             Lecturas de snapshots (Prisma, read-only)
  analysis-data.ts              Concentración (Prisma, read-only)
  real-gains-data.ts            Ganancia real USD (Prisma, read-only)
  tax-report-data.ts            Datos del reporte para impuestos (Prisma, read-only)
  tax-report.ts                 Tenencia al cierre, resultado de ventas, dividendos y CSV (puro)
  alerts.ts                     Reglas de las alertas por mail y contenido del mail (puro)
  expenses.ts                   Gastos del mes: categorías, totales por día y por categoría (puro)
  cash-flow.ts                  Flujo de caja mensual, tasa de ahorro y búsqueda del CCL por fecha (puro)
  local-date.ts                 Fecha y mes locales de Argentina, claves AAAA-MM (puro)
  alerts-runner.ts              Corre las alertas: datos del usuario + Yahoo + envío + AlertLog
  mailer.ts                     Envío por Gmail SMTP (nodemailer)
  market-refresh.ts             Descarga y guardado de datos de mercado (botones y cron diario)
  map-limit.ts                  Promise.all con concurrencia acotada
  cocos-movements.ts            Parser puro de movimientos de Cocos + categorización (corre en cliente y servidor)
  number-parsing.ts             Parseo de números en formato es-AR / Cocos
  format.ts                     Formateadores Intl (ARS/USD/fechas) compartidos
  cache-tags.ts                 Tags del caché de datos por dominio (por userId y globales)
  revalidate.ts                 Helpers de invalidación por dominio (updateTag)
  projections.ts                Cálculos puros de jubilación (sin Prisma)
  inflation.ts                  Índice acumulado de IPC, anualización y rendimiento real
  dca-planner.ts                Plan DCA determinista (water-filling sobre el gap)
  snapshot-returns.ts           Variación %, CAGR, drawdown y serie de rendimiento (sin base $0)
  flow-returns.ts               Rendimiento sin aportes: flujos de las tenencias, Dietz, TWR y TIR
  opportunity-signals.ts        Señales de precio y filtro de noticias del reporte de oportunidades
  opportunity-report.ts         Esquema de salida, entrada compacta y costo por modelo del reporte
  http.ts                       fetchWithTimeout para las APIs externas
  default-strategy.ts           Estrategia por defecto (system prompt) para seed/refresh
  setup-status.ts               Derivación pura del estado de onboarding/setup
  glossary.ts                   Definiciones de términos financieros (tooltips)
  benchmarks-config.ts          Catálogo de benchmarks
  yahoo-finance-client.ts       Cliente Yahoo: precios (cookie + crumb, re-auth ante 401/403) y titulares de noticias
  onboarding/                   Definición de pasos, storage localStorage, targets
  utils.ts                      cn() y helpers
prisma/
  schema.prisma                 Modelos y enums
  migrations/                   Historial de migraciones
  seed.ts                       Seed de estrategia + promoción de admins
scripts/                        (ignorado por .gitignore salvo los scripts listados abajo)
  seed-admin.mjs                Bootstrap de un admin (SQL directo + hash scrypt)
  add-user-id-columns.mjs       Script de migración puntual de columnas userId
  refresh-strategy.ts           Activa lib/default-strategy.ts como nueva versión (pnpm db:strategy)
  backfill-movements.ts         Vincula transacciones legacy al libro de movimientos (one-shot)
```

Los tests (`*.test.ts`, Vitest) viven junto al módulo de `lib/` que prueban.

---

## Capas y flujo de datos

```
Cocos CSV ──┐
dolarapi  ──┤                    ┌── lib/*-data.ts (lecturas Prisma) ── RSC pages
Yahoo     ──┼─ Server Actions ──┤
Anthropic ──┘   (app/actions/)   └── API routes (PDF/CSV/IA)
                      │
                      ▼
                Prisma → PostgreSQL
```

Reglas de la arquitectura (ver `.cursor/rules.md`):

- **RSC pages** (`app/(app)/**/page.tsx`) son síncronas: header y contenido estático van al static shell, y las lecturas van en un componente async dentro de `<Suspense>` que pasa los datos como props a componentes cliente. Las lecturas se cachean con `'use cache'` y un tag por dominio (ver [server-actions.md](./server-actions.md) y [ADR-0017](./adr/0017-cache-components-partial-prerendering-y-prefetching.md)).
- **`lib/` sin Prisma** salvo los helpers de lectura permitidos: `portfolio-data.ts`, `analysis-data.ts`, `real-gains-data.ts`, `tax-report-data.ts`, `alerts-runner.ts` (que además escribe `AlertLog`) y `market-refresh.ts` (descarga y guarda los datos de mercado globales).
- **Toda mutación** pasa por Server Actions que devuelven uniones discriminadas `{ success: true, ... } | { success: false, error }`.
- **API routes** solo para binarios (PDF/CSV/HTML) y la integración con IA. Además del proxy, cada ruta valida la sesión (`401` si falta) y filtra por `userId` (un snapshot ajeno responde `404`).
- **Aislamiento por usuario:** los datos del portafolio se leen y borran siempre con `where: { ..., userId }` (`requireUserId()`); los datos de mercado son globales. Ver [ADR-0008](./adr/0008-aislamiento-por-usuario-y-datos-de-mercado-globales.md).
- **`Decimal` → `Number(...)`** explícito al exponer valores al cliente.

---

## Autenticación y autorización

### Configuración (`lib/auth.ts`)

```ts
betterAuth({
  database: prismaAdapter(db, { provider: "postgresql" }),
  user: {
    additionalFields: {
      role: { type: "string", defaultValue: "USER", required: false, input: false },
    },
  },
  emailAndPassword: { enabled: true, disableSignUp: !allowPublicSignup },
});
```

- `input: false` impide que el cliente envíe `role` en el registro → **no hay escalada de privilegios desde el front**.
- **Registro cerrado por defecto:** `allowPublicSignup = process.env.ALLOW_PUBLIC_SIGNUP === "true"`. Si es `false`, Better Auth rechaza el alta y `/register` redirige a `/login`. El flag se lee por request dentro de `<Suspense>` (después de `searchParams` en `/login` y de `await connection()` en `/register`), así no se congela en el build; `isPublicSignupEnabled()` lo lee en cada llamada.
- El cliente (`lib/auth-client.ts`) usa `inferAdditionalFields<Auth>()` para tipar `session.user.role` y `baseURL` = `NEXT_PUBLIC_APP_URL` (sin definir, usa el origen de la página: funciona en cualquier puerto).

### Helpers server-side (`lib/auth-session.ts`)

| Función | Comportamiento |
|---|---|
| `getSession()` | `auth.api.getSession({ headers })` con `'use cache: private'` + `cacheLife("minutes")`. Deduplica dentro del request (el dashboard dispara ~10 lecturas en paralelo) y le da a la lectura un lifetime para entrar al App Shell por sesión; nunca se guarda en el servidor. No se puede llamar desde un `'use cache'` plano. Devuelve `Session \| null`. |
| `getViewerRole()` | Rol de la sesión para decidir qué UI mostrar (grupo admin del sidebar). No autoriza: para eso están el proxy y `requireAdmin()`. |
| `requireAuth()` | Llama a `getSession()` y **lanza `Error("No autenticado")`** si no hay sesión. |
| `requireUserId()` | `requireAuth()` y devuelve `session.user.id`. Es el helper a usar en toda lectura/escritura de datos de usuario. |
| `requireAdmin()` | `requireAuth()` y lanza `"No autorizado…"` si el rol no es ADMIN. Para actions sobre datos administrados (catálogo, estrategia). |

### Roles (`lib/user-role.ts`)

```ts
export const ADMIN_ROLE = "ADMIN" as const;
export function isAdminRole(role?: string | null): boolean { return role === "ADMIN"; }
```

- Enum Prisma `UserRole`: `USER` (default) | `ADMIN`.
- Nuevos usuarios siempre `USER`. La promoción a admin se hace en la DB (Prisma Studio, SQL, seed o `scripts/seed-admin.mjs`).

### Proxy (`proxy.ts`)

Next.js 16 renombró `middleware.ts` a `proxy.ts`. Corre siempre en **runtime Node.js** (el export `runtime` ya no se permite) y su función exportada se llama `proxy`. Config con `export const config` (matcher `/((?!_next/static|_next/image|favicon.ico).*)`).

Flujo:
1. Deja pasar sin control: `/api/auth*` (`isAuthRoute`), assets estáticos y `/api/cron/*` (`isCronRoute`: el route valida `CRON_SECRET`, ADR-0020).
2. Lee sesión con `auth.api.getSession({ headers: request.headers })`.
3. **Sin sesión** y ruta ≠ `/login` ni `/register` → `redirect("/login")`.
4. **Con sesión** en `/login` o `/register` → `redirect("/")`.
5. **Rutas solo-ADMIN** (`ADMIN_PATH_PREFIXES = ["/assets", "/strategy", "/settings", "/portfolio"]` y sus subrutas): si `!isAdminRole(session.user.role)` → `redirect("/")`.
6. En el resto, `NextResponse.next()`.

> La restricción de rol de las rutas admin vive en el proxy y en el ocultamiento del grupo en el sidebar. Como el proxy protege páginas y no Server Actions, las actions de `assets.ts` y `strategy.ts` y `POST /api/analyze-portfolio` revalidan el rol ADMIN por su cuenta (`requireAdmin()` / `isAdminRole`).

### UI de rol

`app/(app)/layout.tsx` no lee la sesión (así el sidebar entra al static shell). Le pasa a `AppSidebar` el slot `adminNav`: `<Suspense fallback={null}><AdminNav /></Suspense>`, donde `AdminNav` (`components/layout/admin-nav.tsx`, server) lee `getViewerRole()` y renderiza `AdminNavGroup` solo para ADMIN. El grupo "Configuración" (Assets, Estrategia, Configuración, Reporte mensual) aparece cuando se resuelve el rol; a los no-admin nunca se les muestra.

---

## Variables de entorno

| Variable | Obligatoria | Uso |
|---|---|---|
| `DATABASE_URL` | Sí | Conexión PostgreSQL en `lib/db.ts`, `prisma.config.ts`, `prisma/seed.ts` y scripts. |
| `NEXT_PUBLIC_APP_URL` | Recomendada | `baseURL` de Better Auth client. Sin definir, usa el origen de la página. |
| `BETTER_AUTH_SECRET` / `BETTER_AUTH_URL` | Producción | Convención de Better Auth (no referenciadas explícitamente en el código). |
| `ANTHROPIC_API_KEY` | Para `/portfolio` | Header `x-api-key` del análisis con Claude. |
| `ANTHROPIC_MODEL` / `ANTHROPIC_EFFORT` / `ANTHROPIC_TIMEOUT_MS` | Opcional | Config del análisis (modelo, effort, timeout). Ver [integraciones.md](./integraciones.md). |
| `SEED_ADMIN_EMAIL` | Opcional | Lista separada por comas de emails existentes a promover a ADMIN en `prisma/seed.ts`. |
| `ALLOW_PUBLIC_SIGNUP` | Opcional | `true` habilita el registro público (por defecto cerrado). |
| `GMAIL_USER` / `GMAIL_APP_PASSWORD` | Para las alertas | Envío de mails por Gmail SMTP (`lib/mailer.ts`, ADR-0020). |
| `CRON_SECRET` | Producción | Autoriza al cron de Vercel en `/api/cron/alerts`. |
| `NODE_ENV` | Auto | Guard del singleton de Prisma. |

> No hay `.env` ni `.env.example` versionados en el repositorio.

---

## Inicialización de Prisma (`lib/db.ts`)

```ts
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
});
export const db = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
```

- Usa **driver adapter** nativo `pg` (no el engine binario clásico).
- Cliente generado en `app/generated/prisma` (configurado en `schema.prisma` con `output`).
- Patrón singleton para sobrevivir hot-reload en desarrollo.
- `prisma.config.ts` (Prisma 7) resuelve la URL con `env("DATABASE_URL")` y define `migrations.path` y `migrations.seed`.

---

## Temas y estilos

- `app/globals.css`: Tailwind v4 vía `@import "tailwindcss"` (sin `tailwind.config.js`). Tokens de tema en OKLCH para light y `.dark`; primario azul eléctrico (ver `DESIGN.md`); `--radius: 0.75rem`.
- Modo oscuro por clase: `@custom-variant dark (&:is(.dark *))`.
- `app/layout.tsx` usa `ThemeProvider` de `next-themes` con `defaultTheme="dark"` y `enableSystem`, fuentes Plus Jakarta Sans (`--font-plus-jakarta` → `--font-sans`) y JetBrains Mono (`--font-jetbrains-mono` → `--font-mono`), y `<Toaster />` de Sonner. Las fuentes son **self-hosted** con `next/font/local` (woff2 variables, subset latin, en `app/fonts/` con sus licencias OFL): `next/font/google` descarga de Google en cada build y falla de forma intermitente con Turbopack ([vercel/next.js#99114](https://github.com/vercel/next.js/issues/99114)).
- Utilidades de animación: `animate-fade-up`, `animate-fade-in`, `animate-tour-card-in`, `animate-guide-stagger`, y `[data-tour-highlight="true"]` para resaltar targets del tour.

---

## Patrón de una Server Action

```ts
"use server";
import { db } from "@/lib/db";
import { requireUserId } from "@/lib/auth-session";
import { revalidateTrades } from "@/lib/revalidate";

export async function doSomething(input: InputType): Promise<Result> {
  try {
    const userId = await requireUserId();
    // validar → operar con db (filtrando por userId)
    revalidateTrades(userId); // updateTag del dominio, no revalidatePath
    return { success: true, ... };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Error inesperado." };
  }
}
```

Ver la referencia completa en [server-actions.md](./server-actions.md).
