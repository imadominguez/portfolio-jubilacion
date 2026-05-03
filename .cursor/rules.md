# Project Coding Rules

## General Principles

- Prefer simplicity over complexity.
- Keep business logic separate from UI components.
- Use TypeScript strictly — no `any` unless unavoidable, and always comment why.
- Avoid unnecessary abstractions.
- Small, focused components. One responsibility per file.
- Clear, descriptive naming — prefer full words over abbreviations.

---

## Next.js Rules

- Use App Router architecture exclusively.
- Prefer **React Server Components** (RSC) for pages. Fetch data directly in `page.tsx` at the top level.
- Use `"use client"` only when the component needs browser APIs, state, or event handlers.
- Use **Server Actions** for all mutations (create, update, delete). Keep them in `app/actions/`.
- Avoid creating API routes unless serving binary data (PDF, CSV) or integrating external webhooks.
- Async params must be awaited: `const { id } = await params;` (Next.js 16 pattern).

---

## File Structure

```
app/actions/<module>.ts    ← Server Actions for mutations (one file per domain module)
lib/<module>.ts            ← Pure domain logic (no Prisma, no HTTP, no auth)
lib/portfolio-data.ts      ← Read-only DB helpers used across RSC pages
app/(app)/<route>/page.tsx ← RSC page: fetch → pass to client components
components/<module>/       ← Client components per domain
```

**Rule:** `lib/` functions must not call Prisma directly. DB access happens in `app/actions/` or in `lib/portfolio-data.ts` (which is specifically designed for cross-cutting reads).

Exception: `lib/portfolio-data.ts`, `lib/analysis-data.ts`, `lib/real-gains-data.ts` are allowed to use Prisma because they are read-only data helpers, not domain logic.

---

## Database Rules

- All DB access must go through **Prisma** — no raw SQL.
- The Prisma client is a singleton defined in `lib/db.ts`. Always import from there.
- Use clear relational modeling. Avoid duplicating financial data.
- Avoid storing computed values in the DB unless required for historical accuracy (e.g. `allocationPct` on `Position` is intentionally stored to preserve the snapshot state).
- When adding new models: run `prisma migrate dev` to create a migration file.

---

## State Management

- Use **Zustand** only for client-side UI state (e.g. modal open/close, form step).
- Do not store server data in Zustand. Server data flows through RSC → client component props.
- Prefer `useTransition` for pending states on Server Action calls.

---

## Financial Data Rules

- **Never overwrite historical portfolio snapshots.** Snapshots are immutable records.
- **Never recompute and store** what was already recorded at snapshot time (e.g. the CCL at snapshot date must not be updated later).
- Any conversion between ARS and USD must use the CCL recorded at the relevant date — not the current CCL.
- All financial values in the DB use `Decimal` type (Prisma) to avoid floating-point errors.
- When mapping Prisma `Decimal` to TypeScript, always call `Number(value)` explicitly.

---

## Server Action Pattern

```typescript
"use server";

import { db } from "@/lib/db";
import { revalidatePath } from "next/cache";

export async function doSomething(input: InputType): Promise<Result> {
  try {
    // validate input
    // db operation
    revalidatePath("/affected-path");
    return { success: true, ... };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error inesperado.";
    return { success: false, error: message };
  }
}
```

Always return a discriminated union `{ success: true, ... } | { success: false, error: string }`.

---

## Price Cache Rules

- **MarketPriceCache** — stores latest ARS/USD price per ticker. Updated via the "Actualizar precios" button. Do not call Yahoo Finance on every page load.
- **HistoricalPriceCache** — stores daily USD price per underlying ticker. Populated on demand for Real Gains. Check DB before calling Yahoo Finance.
- **ExchangeRate** — CCL per date. Updated via dolarapi.com (today) or argentinadatos.com (historical backfill).

---

## PDF Export Rules

- PDF exports use `@react-pdf/renderer` in API routes (server-side).
- The PDF component lives in `components/export/portfolio-pdf.tsx` using `@react-pdf/renderer` primitives (`Document`, `Page`, `View`, `Text`, `StyleSheet`).
- Do not use Tailwind or shadcn inside PDF components — use `StyleSheet.create()` with inline styles.
- The API route at `app/api/export/pdf/[snapshotId]/route.ts` calls `renderToBuffer()` and returns `application/pdf`.

---

## CCL Handling

- CCL values are stored in the `ExchangeRate` model with a unique constraint on `date`.
- When inserting CCL for today, use `upsert` (may already exist if updated twice in a day).
- The CCL used in a snapshot conversion must be taken from the `ccl` field on `PortfolioSnapshot`, not from today's rate.

---

## UI Rules

- Use **shadcn/ui** components from `components/ui/`. Do not invent new base components when shadcn has one.
- Follow the existing KPI card pattern: border, bg-card, shadow-sm, px-5 py-4.
- Use `ChartContainer` + Recharts for all charts. Follow the pattern in `components/performance/performance-chart.tsx`.
- Use `SiteHeader` for all page headers — pass `title`, `description`, and `actions` props.
- All pages are wrapped in `<div className="flex flex-col min-h-svh">`.
- Use `animate-fade-up` on `section` elements with progressive `animationDelay` (0ms, 100ms, 200ms…).
- The sidebar is defined in `components/layout/app-sidebar.tsx`. To add a route: add an entry to `NAV_MAIN`, `NAV_ANALYSIS`, or `NAV_CONFIG` array.
- Use responsive design — `grid-cols-2 sm:grid-cols-4` pattern for KPI rows.

---

## Code Quality

- No comments that just narrate what the code does. Comments should explain *why*, not *what*.
- Avoid premature optimization — prefer clarity.
- Do not add `console.log` statements to production code.
- When mapping over arrays for JSX, always provide a stable `key` prop (prefer DB `id` over array index).
- Use `Intl.NumberFormat` and `Intl.DateTimeFormat` with `"es-AR"` locale for all user-facing numbers and dates.
