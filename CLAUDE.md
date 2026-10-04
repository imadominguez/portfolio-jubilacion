# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

Private personal finance dashboard for a long-term CEDEAR portfolio (Argentina, broker Cocos Capital). Next.js 16 App Router + React 19, Prisma 7 + PostgreSQL, Better Auth, shadcn/ui + Tailwind v4, Recharts. UI text, docs and commit messages are in Spanish (commit prefix style: `(feature): ...`, `(refactor): ...`, `(docs): ...`).

Detailed docs live in `docs/` (Spanish): `arquitectura.md`, `modelo-de-datos.md`, `logica-financiera.md` (all formulas and where they live), `server-actions.md`, `integraciones.md`, `desarrollo.md` (includes known tech debt). **Architecture decisions and their rationale are in `docs/adr/`**. Read the relevant ADR before changing something that looks deliberate (immutability, manual refresh, per-user filtering, deterministic DCA). If a change contradicts an accepted ADR, add a new ADR that supersedes it rather than editing the old one. Coding rules originate in `.cursor/rules.md`; domain context in `.cursor/context.md` / `.cursor/domain.md`. Design tokens/visual language in `DESIGN.md`.

## Commands

```bash
npm run dev                         # http://localhost:3000
npm run lint                        # eslint
npm test                            # vitest run (all **/*.test.ts)
npx vitest run lib/cocos-movements.test.ts   # single test file
npx vitest run -t "name of test"    # single test by name
npm run build
npx prisma generate                 # required after schema changes / fresh clone (client → app/generated/prisma)
npx prisma migrate dev --name <x>   # schema changes
npm run db:seed                     # seed strategy + promote SEED_ADMIN_EMAIL users to ADMIN
npm run db:strategy                 # activate lib/default-strategy.ts as a new strategy version
```

CI (`.github/workflows/ci.yml`) runs: `npm install` → `prisma generate` → lint → test → build, with dummy `DATABASE_URL`/`BETTER_AUTH_SECRET`/`NEXT_PUBLIC_APP_URL`.

Tests are pure unit tests on `lib/` domain logic (node environment, no DB). `@` alias maps to repo root.

Real account data is never committed. `__fixtures__/`, `docs/movimientos/*.csv` and `docs/portfolio_report/` hold real Cocos exports and are gitignored. Tests use synthetic CSVs; tests against the real files are skipped (`describe.skipIf`) when the files are missing, as in CI. `scripts/*` is gitignored except for explicit `!scripts/<name>` entries; add one for any script that `package.json` or the docs rely on.

**Migrations:** never use `prisma migrate reset` (destroys real data). If drift appears, generate SQL with `npx prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --script` and apply via `prisma db execute` + `prisma migrate resolve --applied`.

## Architecture

```
Cocos CSV / dolarapi / argentinadatos / Yahoo / Anthropic
        │
   Server Actions (app/actions/<domain>.ts) ──► Prisma (lib/db.ts) ──► PostgreSQL
        │
   lib/*-data.ts (read-only Prisma helpers) ──► RSC pages app/(app)/<route>/page.tsx ──► client components (components/<domain>/)
   API routes (app/api/) only for binary output (PDF/CSV/HTML export) and the AI analysis
```

Layering rules:
- **Pages are RSC** that fetch data at the top and pass props to `"use client"` components. No client-side data store for server data.
- **All mutations are Server Actions** in `app/actions/`, starting with `requireAuth()` (`lib/auth-session.ts`) and returning a discriminated union `{ success: true, ... } | { success: false, error: string }` (catch errors, don't throw to the client).
- After a mutation, invalidate via the helpers in `lib/revalidate.ts` (e.g. `revalidatePortfolioData()`), which know which routes consume which data — prefer them over ad-hoc `revalidatePath`.
- **`lib/` is pure domain logic without Prisma**, except the read helpers `portfolio-data.ts`, `analysis-data.ts`, `real-gains-data.ts`. New calculations go in `lib/` as pure functions with a colocated `*.test.ts`.
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

## UI conventions

- Use shadcn components from `components/ui/` (don't hand-edit unless needed); `SiteHeader` for page headers (`title`, `description`, `actions`); `ChartContainer` + Recharts for charts (reference: `components/performance/performance-chart.tsx`).
- Each route has `loading.tsx`; `(app)` has shared `error.tsx` / `not-found.tsx`.
- Format numbers/dates with the helpers in `lib/format.ts` (`formatARS`, `formatUSD`, …): locale `"es-AR"` for numbers and dates, `"en-US"` for USD amounts.
- PDF export (`components/export/portfolio-pdf.tsx`) uses `@react-pdf/renderer` primitives + `StyleSheet.create()` — no Tailwind/shadcn there.
- Next 16: `params` is async — `const { id } = await params;`.
- No `console.log` in production code; comments explain *why*, not *what*.

## Environment

`DATABASE_URL` (required), `NEXT_PUBLIC_APP_URL`, `BETTER_AUTH_SECRET`/`BETTER_AUTH_URL` (prod), `ANTHROPIC_API_KEY` (+ optional `ANTHROPIC_MODEL`, `ANTHROPIC_EFFORT`, `ANTHROPIC_TIMEOUT_MS`) for the monthly AI report at `/portfolio` (`app/api/analyze-portfolio/route.ts`), `SEED_ADMIN_EMAIL`, `ALLOW_PUBLIC_SIGNUP`.
