# AI Agent Context

This project is a personal financial dashboard used to manage a long-term investment portfolio focused on CEDEARs. The system is designed for private use and imports portfolio snapshots from Cocos Capital CSV exports.

---

## Goals

- Track portfolio value in ARS and USD
- Analyze historical growth, performance, and concentration
- Manage transactions (BUY/SELL) and dividend income
- Plan retirement with projections and Monte Carlo simulation
- Measure real gains separating underlying appreciation from CCL impact
- Rebalance portfolio against target allocations
- Track and visualize the CCL (Contado con Liquidación) exchange rate history
- Export portfolio reports as PDF

---

## Tech Stack

**Framework:** Next.js 16 (App Router, React 19)
**UI:** shadcn/ui, TailwindCSS v4, Recharts, Lucide React
**Auth:** Better Auth (email/password, session-based)
**Backend:** Next.js Server Actions (`app/actions/`), minimal API routes
**Database:** PostgreSQL + Prisma ORM (client output at `app/generated/prisma/`)
**PDF Export:** @react-pdf/renderer (server-side, API route)

**Data sources:**
- CSV portfolio exports from Cocos Capital
- dolarapi.com and argentinadatos.com (CCL)
- Yahoo Finance via `lib/yahoo-finance-client.ts` (market prices, historical prices)

---

## Architecture

```
app/
  (app)/          ← authenticated pages (sidebar layout)
    page.tsx      ← Dashboard
    performance/  ← CAGR, drawdown, benchmarks
    ccl/          ← CCL history and portfolio USD overlay
    snapshots/    ← snapshot list + detail
    analysis/     ← concentration by sector/country/industry
    rebalance/    ← target vs actual allocation
    transactions/ ← BUY/SELL, PPM, P&L realizado, dividends
    retirement/   ← retirement calculator + Monte Carlo
    real-gains/   ← real USD gains vs CCL impact
    assets/       ← CEDEAR catalog (ratio, sector, country)
    settings/     ← milestones
  (auth)/
    login/
    register/
  actions/        ← Server Actions (one file per domain module)
  api/
    auth/[...all]/
    export/
      snapshot/[id]/  ← HTML (print) + CSV
      pdf/[snapshotId]/  ← PDF via @react-pdf/renderer
  generated/prisma/

components/
  ccl/            ← CCLChart (Recharts, dual Y-axis)
  dashboard/      ← Hero, HoldingsTable, AllocationPanel, MilestoneWidget, etc.
  export/         ← ExportButtons, portfolio-pdf (react-pdf Document)
  performance/    ← PerformanceChart, BenchmarkOverlayChart
  analysis/       ← ConcentrationCharts
  rebalance/      ← RebalanceClient
  retirement/     ← RetirementClient
  real-gains/     ← RealGainsUpdateButton, RealGainsWizard
  snapshots/      ← ImportCSVSheet, SnapshotsClient
  transactions/   ← TransactionForm, DividendForm, TransactionsClient
  assets/         ← AssetDialog, AssetsTableClient
  layout/         ← AppSidebar, SiteHeader
  ui/             ← shadcn components

lib/
  auth.ts / auth-client.ts / auth-session.ts  ← Better Auth config
  db.ts           ← Prisma instance (singleton)
  portfolio-data.ts   ← getLatestSnapshot, getAllSnapshotPoints, etc.
  analysis-data.ts    ← getConcentrationData (sector/country/industry)
  real-gains-data.ts  ← calculateRealGains (ARS gain, USD gain, CCL impact)
  projections.ts      ← buildProjectionCurve, runMonteCarlo
  benchmarks-config.ts
  yahoo-finance-client.ts
  utils.ts
```

---

## Implemented Modules

| Route | Description |
|-------|-------------|
| `/` | Dashboard: KPIs (ARS/USD/CCL/positions/change vs prev), unrealized P&L, dividends, chart, performers, holdings table, milestones |
| `/performance` | CAGR, max drawdown, yearly return, portfolio chart, benchmarks overlay (S&P 500, Merval, Nasdaq), snapshot timeline |
| `/ccl` | CCL history chart with dual Y-axis, overlay portfolio USD, KPIs (current/1m/YTD/1y change) |
| `/snapshots` | Chronological list with % change; detail page per snapshot |
| `/snapshots/[id]` | KPIs, AllocationPanel, HoldingsTable, export buttons (PDF/HTML/CSV) |
| `/analysis` | Concentration by sector, country, industry (pie + bar charts) |
| `/rebalance` | TargetAllocation vs current positions, deviation, suggested actions |
| `/transactions` | BUY/SELL history, PPM per ticker, realized P&L, dividends, import, CSV export |
| `/retirement` | Retirement calculator, deterministic projection curve, Monte Carlo simulation |
| `/real-gains` | Real USD gains broken down by underlying appreciation vs CCL impact |
| `/assets` | CEDEAR catalog (ratio, sector, industry, country, underlying ticker), inline editing |
| `/settings` | Milestone management (USD targets, reached status) |

---

## Core Domain Concepts

- **Portfolio** — collection of positions at a point in time
- **Position** — holding of a specific CEDEAR (ticker, quantity, price, value, allocation %)
- **PortfolioSnapshot** — immutable record of the portfolio state on a given date
- **ExchangeRate** — daily CCL value (ARS per USD)
- **Transaction** — BUY or SELL operation with PPM tracking
- **Dividend** — income received per ticker
- **TargetAllocation** — desired % per ticker for rebalancing
- **RetirementSettings** — retirement calculator inputs
- **MilestoneAlert** — USD value targets with reached tracking
- **BenchmarkPoint** — historical value for a benchmark index
- **MarketPriceCache / HistoricalPriceCache** — Yahoo Finance price cache

---

## Key Principles

- Snapshots are **immutable** — never modify historical data
- All DB access through Prisma; no raw SQL
- Business logic lives in `lib/` (pure functions) and `app/actions/` (Server Actions with DB)
- UI components are thin — data fetching happens in RSC page files
- Yahoo Finance prices are cached in DB to avoid repeated external calls
- CCL is fetched from dolarapi.com (today) and argentinadatos.com (historical)

---

## Agent Capabilities

The agent should help with:

- Designing and modifying Prisma schemas and migrations
- Building dashboard UI with shadcn and Recharts
- Implementing financial calculations (PPM, CAGR, drawdown, Monte Carlo)
- Parsing CSV files (Cocos Capital format)
- Managing portfolio snapshots and actions
- Creating data visualizations using Recharts within ChartContainer
- Implementing Server Actions following the existing pattern in `app/actions/`
- Building PDF exports using @react-pdf/renderer in API routes
- Adding new pages following the `app/(app)/[route]/page.tsx` RSC pattern
