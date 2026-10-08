# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Private personal finance dashboard for a long-term CEDEAR portfolio (Argentina, broker Cocos Capital). Next.js 16 App Router + React 19, Prisma 7 + PostgreSQL, Better Auth, shadcn/ui + Tailwind v4, Recharts. UI text, docs and commit messages are in Spanish (commit prefix style: `(feature): ...`, `(refactor): ...`, `(docs): ...`).

Detailed docs live in `docs/` (Spanish): `arquitectura.md`, `modelo-de-datos.md`, `logica-financiera.md` (all formulas and where they live), `server-actions.md`, `integraciones.md`, `desarrollo.md` (includes known tech debt). **Architecture decisions and their rationale are in `docs/adr/`**. Read the relevant ADR before changing something that looks deliberate (immutability, manual refresh, per-user filtering, deterministic DCA). If a change contradicts an accepted ADR, add a new ADR that supersedes it rather than editing the old one. Coding rules originate in `.cursor/rules.md`; domain context in `.cursor/context.md` / `.cursor/domain.md`. Design tokens/visual language in `DESIGN.md`.

## Commands

**pnpm only** (`packageManager: pnpm@8.10.5`; there is no `package-lock.json`). Never run `npm install` or `npx`; add deps with `pnpm add` / `pnpm add -D` so `pnpm-lock.yaml` stays in sync (CI uses `--frozen-lockfile`).

```bash
pnpm dev                                      # http://localhost:3000
pnpm lint                                     # eslint
pnpm test                                     # vitest run (all **/*.test.ts)
pnpm vitest run lib/cocos-movements.test.ts   # single test file
pnpm vitest run -t "name of test"             # single test by name
pnpm build
pnpm prisma generate                          # required after schema changes / fresh clone (client → app/generated/prisma)
pnpm prisma migrate dev --name <x>            # schema changes
pnpm db:seed                                  # seed strategy + promote SEED_ADMIN_EMAIL users to ADMIN
pnpm db:strategy                              # activate lib/default-strategy.ts as a new strategy version
```

CI (`.github/workflows/ci.yml`) runs: `pnpm install --frozen-lockfile` → `prisma generate` → lint → test → build, with dummy `DATABASE_URL`/`BETTER_AUTH_SECRET`/`NEXT_PUBLIC_APP_URL`.

Tests are pure unit tests on `lib/` domain logic (node environment, no DB). `@` alias maps to repo root.

Real account data is never committed. `__fixtures__/`, `docs/movimientos/*.csv` and `docs/portfolio_report/` hold real Cocos exports and are gitignored. Tests use synthetic CSVs; tests against the real files are skipped (`describe.skipIf`) when the files are missing, as in CI. `scripts/*` is gitignored except for explicit `!scripts/<name>` entries; add one for any script that `package.json` or the docs rely on.

**Migrations:** never use `prisma migrate reset` (destroys real data). If drift appears, generate SQL with `pnpm prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` and apply via `prisma db execute` + `prisma migrate resolve --applied`.

## Architecture

```
Cocos CSV / dolarapi / argentinadatos / Yahoo / Anthropic
        │
   Server Actions (app/actions/<domain>.ts) ──► Prisma (lib/db.ts) ──► PostgreSQL
        │
   lib/*-data.ts (read-only Prisma helpers) ──► RSC pages app/(app)/<route>/page.tsx ──► client components (components/<domain>/)
   API routes (app/api/) only for binary output (PDF/CSV/HTML export) and the AI analysis
```

**Next.js 16.3 with Cache Components enabled** (`cacheComponents: true` ⇒ Partial Prerendering). This is not the Next.js of your training data: read the version-accurate docs in `node_modules/next/dist/docs/` before writing Next code (start with `01-app/02-guides/migrating-to-cache-components.md` and `authentication-with-cache-components.md`). Rules and rationale are in ADR-0017. The Next.js MCP (`next-devtools`, `.mcp.json`) exposes dev-server errors and Cache Components insights via `get_errors` while `pnpm dev` runs; instant-navigation insights only show there or in the dev overlay, not in `pnpm build`.

Cache Components adoption is **complete**: no route uses `export const instant = false`; don't add it without a documented reason. Every page is synchronous: `SiteHeader` and static copy go into the static shell, data reads go into an async component inside `<Suspense>` whose fallback is a skeleton shared with the route's `loading.tsx` (`components/<domain>/*-skeleton.tsx`). Rules:
- Never await session/`cookies()`/`headers()`/`params`/`searchParams` at the top of a layout or page; move the read into an async component inside `<Suspense>`.
- Never read `cookies()`/`headers()` inside plain `'use cache'`; resolve the user outside and pass only `userId` to an unexported `'use cache'` function with `cacheLife` + `cacheTag(\`<domain>:${userId}\`)`, or use `'use cache: private'`.
- `new Date()` / `Date.now()` / `Math.random()` during render must come after request data or `await connection()` inside `<Suspense>`.
- Route segment configs `dynamic`, `revalidate`, `fetchCache`, `dynamicParams`, `runtime` are not allowed (build error).
- State persists across navigations (`<Activity>`): forms/dialogs may need explicit resets, and a client that copies props into `useState` needs a `key` derived from the data (see `MilestonesClient`, `StrategyEditor`).
- A `loading.tsx` wraps every route below its folder and its fallback lands in each of their static shells: keep route-specific loadings in their own segment or route group (the Dashboard's lives in `app/(app)/(dashboard)/`). To see what a route's shell contains, `pnpm build` and inspect `.next/server/app/<route>.html`.
- If the `next-devtools` MCP client fails to connect, the same tools are served by the dev server at `POST /_next/mcp` (JSON-RPC, `Accept: application/json, text/event-stream`).

Layering rules:
- **Pages are RSC** that fetch data and pass props to `"use client"` components (data reads behind `<Suspense>`, see above). No client-side data store for server data.
- **All mutations are Server Actions** in `app/actions/`, starting with `requireAuth()` (`lib/auth-session.ts`) and returning a discriminated union `{ success: true, ... } | { success: false, error: string }` (catch errors, don't throw to the client).
- Reads are cached per domain: the exported getter resolves the user and calls an unexported `'use cache'` function with `cacheLife("hours")` and one `cacheTag` per domain it reads (tag builders in `lib/cache-tags.ts`; never export a cached function taking `userId` — in a `"use server"` file it becomes a callable action). Reads with no request data (global market data) call `await connection()` first so they don't hit the DB during `next build` (CI has no DB).
- After a mutation, invalidate via the helpers in `lib/revalidate.ts` (e.g. `revalidatePortfolioData(userId)`), which `updateTag` the written domain — never ad-hoc `revalidatePath`. `updateTag` only works in Server Actions; use `revalidateTag(tag, "max")` in Route Handlers.
- **`lib/` is pure domain logic without Prisma**, except the read helpers `portfolio-data.ts`, `analysis-data.ts`, `real-gains-data.ts`, `tax-report-data.ts`. New calculations go in `lib/` as pure functions with a colocated `*.test.ts`.
- Prisma client is the singleton from `lib/db.ts` (driver adapter `PrismaPg`); generated client in `app/generated/prisma` — don't edit. No raw SQL in app code.
- **Multi-user data isolation:** domain rows carry `userId`; every read/delete must filter by the current user (`requireUserId()` from `lib/auth-session.ts`), including export API routes.

Auth and roles:
- Better Auth (email/password). `User.role` is `USER` (default) or `ADMIN`, exposed via `additionalFields` with `input: false`; promotion only via DB (SQL/Prisma Studio/seed). Helper: `lib/user-role.ts` (`isAdminRole`).
- `proxy.ts` (Next 16's replacement for `middleware.ts`, always Node runtime) redirects unauthenticated users to `/login` and non-admins away from `ADMIN_PATH_PREFIXES` (`/assets`, `/strategy`, `/settings`, `/portfolio`). Admin pages must also be listed under `NAV_CONFIG` in `components/layout/app-sidebar.tsx`, and both lists must stay in sync.
- The proxy guards pages, not Server Actions: an action can be invoked from any page the user can reach. Admin-only actions must check the role themselves with `requireAdmin()` from `lib/auth-session.ts` (used by `assets.ts` and `strategy.ts`; `/api/analyze-portfolio` returns 403 to non-admins).
- Public signup is closed unless `ALLOW_PUBLIC_SIGNUP=true`.

Import pipeline: the Cocos movements CSV is parsed and categorized by `lib/cocos-movements.ts` into the `Movement` ledger (source of truth, idempotent via `@@unique([userId, nroTicket])`). Only `TRADE_BUY`/`TRADE_SELL` movements produce a linked `Transaction` (1:1 via `movementId`), which feeds PPM / realized P&L. Portfolio snapshots come from a separate Cocos holdings CSV (`app/actions/snapshots.ts`).

## Financial data invariants

- `PortfolioSnapshot`s are **immutable**: never overwrite a snapshot or the CCL recorded on it. ARS↔USD conversions for historical data use the CCL of that date (`PortfolioSnapshot.ccl` / `ExchangeRate`), never today's rate.
- Money is `Decimal` in Prisma; convert explicitly with `Number(value)` when exposing to TS/clients.
- `Position.allocationPct` is stored as a fraction (0–1) intentionally (historical accuracy); the data layer exposes it ×100.
- `ExchangeRate` is unique per date — use `upsert` for today's CCL.
- External prices are cached (`MarketPriceCache`, `HistoricalPriceCache`); check the DB before calling Yahoo (`lib/yahoo-finance-client.ts`), never on every page load.
- Every external HTTP call (Yahoo, dolarapi, argentinadatos) goes through `fetchWithTimeout` (`lib/http.ts`), so a hung API returns a clear error instead of holding the Server Action until `maxDuration`.
- The AI report (ADR-0018): the app computes every number in `lib/` (pure, tested) and Claude only judges. The output format lives in `OpportunityAnalysisSchema` (structured outputs), not in the strategy prompt; when switching models add its prices to `MODEL_PRICING` and its capabilities to `modelRequestOptions`.

## UI conventions

- Use shadcn components from `components/ui/` (don't hand-edit unless needed); `SiteHeader` for page headers (`title`, `description`, `actions`); `ChartContainer` + Recharts for charts (reference: `components/performance/performance-chart.tsx`).
- Each route has `loading.tsx`; `(app)` has shared `error.tsx` / `not-found.tsx`.
- Format numbers/dates with the helpers in `lib/format.ts` (`formatARS`, `formatUSD`, …): locale `"es-AR"` for numbers and dates, `"en-US"` for USD amounts.
- PDF export (`components/export/portfolio-pdf.tsx`) uses `@react-pdf/renderer` primitives + `StyleSheet.create()` — no Tailwind/shadcn there.
- Next 16: `params` is async — `const { id } = await params;`.
- No `console.log` in production code; comments explain *why*, not *what*.

## Environment

`DATABASE_URL` (required), `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` (prod), `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `ANTHROPIC_TIMEOUT_MS`) for the AI opportunities report at `/portfolio` (`app/api/analyze-portfolio/route.ts`, ADR-0018: the app prepares prices and news, Claude only judges; `@anthropic-ai/sdk` with structured outputs, default model `claude-sonnet-5-5`), `SEED_ADMIN_EMAIL`, `ALLOW_PUBLIC_SIGNUP`.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
