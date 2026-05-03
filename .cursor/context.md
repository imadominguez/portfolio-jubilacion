# Project Context

## Overview

This is a **personal financial dashboard** for managing and analyzing a long-term investment portfolio.

- **Private use** — single user (authenticated via Better Auth)
- **Focus** — CEDEARs (Certificados de Depósito Argentinos) purchased through Cocos Capital
- **Goal** — track portfolio evolution, analyze performance, and plan for retirement

---

## Data Source

Portfolio data comes from **CSV exports from Cocos Capital**.

These CSVs represent a **snapshot of the portfolio at a specific point in time** — not individual trades.

Each snapshot contains:
- ticker symbol and instrument name
- quantity held
- price in ARS
- total position value
- (computed) allocation percentage

Snapshots must **never be modified or overwritten** — they are immutable historical records.

Transactions (BUY/SELL) and dividends are entered manually via forms.

---

## Application Sections

### Dashboard (`/`)
Main overview of the portfolio:
- KPIs: total value ARS, total value USD, CCL, position count, change vs previous snapshot
- Unrealized P&L vs PPM (average cost)
- Total dividends received (USD)
- Portfolio evolution chart (ARS and USD toggle)
- Top performers / worst performers vs previous snapshot
- Holdings table with PPM, market price, and P&L columns
- Allocation panel (percentage breakdown)
- Milestone progress widgets

### Performance (`/performance`)
Historical performance analysis:
- CAGR (compound annual growth rate)
- Maximum drawdown
- Current-year return in ARS
- Portfolio evolution chart with ARS/USD toggle
- Benchmark comparison overlay (S&P 500, Merval, Nasdaq 100)
- Snapshot timeline with % change between records

### Historial CCL (`/ccl`)
Exchange rate (Contado con Liquidación) history:
- KPIs: current CCL, 1-month change, year-to-date change, 1-year change
- Line chart with daily CCL values
- Optional overlay: portfolio USD value on same chart to see correlation/decorrelation
- Full chronological table of recorded CCL values

### Snapshots (`/snapshots`)
Chronological list of all imported snapshots:
- Date, total value ARS, change % vs previous
- Link to full detail of each snapshot

### Snapshot Detail (`/snapshots/[id]`)
Full breakdown of a single snapshot:
- KPIs: ARS value, USD value, CCL, position count
- AllocationPanel (donut chart + percentage list)
- HoldingsTable (sorted by value)
- Export options: PDF download, print/preview, CSV download

### Análisis (`/analysis`)
Portfolio concentration analysis using the latest snapshot + asset metadata:
- By sector (Technology, Finance, Consumer Discretionary, etc.)
- By country (USA, Argentina, etc.)
- By industry
- Pie charts and bar charts

### Rebalanceo (`/rebalance`)
Target vs actual allocation management:
- Edit target % per ticker (TargetAllocation table)
- Current % from latest snapshot
- Deviation from target
- Suggested action (buy/sell) to reach target

### Transacciones (`/transactions`)
Full transaction history:
- BUY and SELL operations with price, quantity, currency
- PPM (precio promedio de compra) per ticker
- Realized P&L per position
- Dividend income (ticker, date, gross/net amounts)
- Import movements from CSV
- Export all transactions as CSV

### Jubilación (`/retirement`)
Retirement planning calculator:
- Inputs: current age, retirement age, monthly expenses, inflation, withdrawal rate, monthly contribution
- Required capital (via withdrawal rate rule)
- Gap between current portfolio and goal
- On-track indicator
- Deterministic projection curve
- Monte Carlo simulation with percentile bands and success probability

### Ganancia Real (`/real-gains`)
Real USD gain breakdown:
- Two methodologies: gain in ARS terms vs gain in USD terms
- Underlying stock appreciation (from HistoricalPriceCache + CEDEAR ratio)
- CCL impact (how much of the ARS gain is just exchange rate)
- Per-ticker table with coverage indicators
- Data wizard to populate missing historical prices

### Assets (`/assets`)
CEDEAR catalog (reference table):
- Ticker, CEDEAR ratio, sector, industry, country, underlying ticker
- Inline editing via dialog
- Buttons: update CCL, update market prices, import snapshot

### Configuración (`/settings`)
Milestone management:
- Define target portfolio values in USD
- Track reached status and date
- Shown as progress widgets on the Dashboard

---

## CEDEAR Financial Concepts

CEDEARs are Argentine certificates that represent foreign stocks traded locally.

**Pricing formula:**
```
CEDEAR price (ARS) ≈ (Stock price USD / CEDEAR ratio) × CCL
```

**Variables:**
- `Stock price USD` — price of the underlying US stock (e.g. AAPL = $180)
- `CEDEAR ratio` — how many CEDEARs represent one share (e.g. AAPL ratio = 10)
- `CCL` — Contado con Liquidación rate (implicit USD/ARS rate in the financial market)

This means a CEDEAR's ARS price moves with three factors:
1. The underlying stock price in USD
2. The CEDEAR ratio (fixed)
3. The CCL exchange rate

**Real gains** separate how much of the portfolio's ARS growth came from:
- Actual stock appreciation (measured in USD)
- CCL devaluation of the peso

---

## Key Metrics Tracked

| Metric | Description |
|--------|-------------|
| Portfolio value ARS | Sum of all position values |
| Portfolio value USD | ARS value ÷ CCL |
| Allocation % | Position value ÷ total value |
| PPM | Weighted average purchase price per ticker |
| Unrealized P&L | Current value vs PPM-based cost |
| Realized P&L | Gains/losses from closed positions |
| CAGR | Compound annual growth rate across snapshot history |
| Max Drawdown | Largest peak-to-trough decline in portfolio value |
| Dividend income | Total net dividends received in USD |
| CCL | Daily USD/ARS exchange rate from dolarapi.com |
| Underlying appreciation | USD gain of the stock itself (via Yahoo Finance) |
| Retirement target | Required capital = annual expenses ÷ withdrawal rate |
| Monte Carlo success | % of simulated scenarios reaching retirement goal |

---

## Long-Term Goal

The system helps answer:

- How much is the portfolio worth today? (ARS and USD)
- How fast is it growing compared to benchmarks?
- Is the portfolio on track for retirement?
- How much of the growth is real (USD appreciation) vs peso devaluation?
- How concentrated is the portfolio by sector/country?
- What adjustments are needed to reach target allocations?
- How has the CCL moved over time and how does it correlate with portfolio USD value?
