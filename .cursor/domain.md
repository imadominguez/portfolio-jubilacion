# Domain Knowledge

This document describes the financial domain concepts and data models used in the portfolio dashboard.

The system manages a personal investment portfolio focused on **CEDEARs** purchased through **Cocos Capital**.

---

## CEDEARs

CEDEARs (Certificados de Depósito Argentinos) are instruments that let Argentine investors buy foreign stocks through the local market.

Each CEDEAR represents a fraction of an underlying stock traded in the United States.

**Pricing formula:**
```
CEDEAR price (ARS) ≈ (Stock price USD / CEDEAR ratio) × CCL
```

Example:
- Stock price = $180 USD (AAPL)
- CEDEAR ratio = 10 (10 CEDEARs = 1 AAPL share)
- CCL = 1200 ARS/USD
- CEDEAR price ≈ (180 / 10) × 1200 = 2160 ARS

---

## CEDEAR Ratio

The ratio defines how many CEDEARs represent one underlying share. It is fixed and stored in the `Asset` table.

Examples:
- AAPL: ratio 10
- NVDA: ratio 24
- MELI: ratio 2

The ratio is required to convert between CEDEAR quantity → underlying share quantity → USD value.

---

## CCL (Contado con Liquidación)

The CCL is the implicit USD/ARS exchange rate in the Argentine financial market. It is used to estimate the USD value of a CEDEAR portfolio.

```
Portfolio USD = Portfolio ARS / CCL
```

The system stores daily CCL values in the `ExchangeRate` table, sourced from:
- `dolarapi.com` — today's CCL
- `argentinadatos.com` — historical CCL series

---

## Portfolio Snapshot

A snapshot is an **immutable record** of the entire portfolio at a specific date.

Created by importing a CSV export from Cocos Capital. Each snapshot contains:
- `snapshotDate` — the date of the snapshot
- `totalValueArs` — total portfolio value in ARS
- `totalValueUsd` — optional USD equivalent at snapshot CCL
- `ccl` — the CCL used for USD conversion at that date
- `positions[]` — all holdings at that moment

**Snapshots must never be modified.** They are the historical source of truth.

---

## Position

A position is one row within a snapshot — the holding of a specific CEDEAR.

Fields:
- `ticker` — CEDEAR ticker (e.g. AAPL, MELI)
- `instrumentName` — human-readable name
- `quantity` — number of CEDEARs held
- `price` — ARS price per unit
- `positionValue` — quantity × price
- `allocationPct` — fraction of total portfolio (0–1)
- `currency` — always ARS for Cocos CSV

---

## Asset (CEDEAR Catalog)

The `Asset` table stores reference metadata for each CEDEAR.

Fields:
- `ticker` — primary key
- `cedearRatio` — how many CEDEARs per underlying share
- `underlyingTicker` — the US stock ticker (e.g. "AAPL" for the AAPL CEDEAR)
- `sector` — e.g. Technology, Financials, Consumer Discretionary
- `industry` — e.g. Semiconductors, Banks
- `country` — e.g. USA, Argentina

Used for concentration analysis and real gains calculation.

---

## Transaction

A `Transaction` represents a BUY or SELL operation entered manually.

Fields:
- `ticker`
- `type` — `BUY` or `SELL`
- `quantity`
- `priceArs` — price paid/received per unit in ARS
- `date`
- `currency`

Used to calculate PPM and realized P&L.

---

## PPM (Precio Promedio de Compra / Average Cost)

PPM is the weighted average purchase price per ticker, calculated from all BUY transactions.

```
PPM = Σ(quantity × price) / Σ(quantity)
```

Used to measure unrealized P&L against current snapshot prices.

```
Unrealized P&L (ARS) = (currentPrice - PPM) × quantityHeld
```

---

## Realized P&L

Profit or loss from closed positions (SELL transactions).

```
Realized P&L = (salePrice - PPM at time of sale) × quantitySold
```

---

## Dividend

Income received from a CEDEAR position.

Fields:
- `ticker`
- `date`
- `grossAmountUsd` — dividend before tax
- `taxWithheld` — withholding tax amount
- `netAmountUsd` — actual amount received

---

## Target Allocation

`TargetAllocation` defines the desired portfolio weight for each ticker used in the Rebalance module.

```
Deviation = actualPct - targetPct
Action = BUY if deviation < -tolerance, SELL if deviation > +tolerance
```

Tolerance is ±1% by default.

---

## Performance Metrics

### CAGR (Compound Annual Growth Rate)

```
CAGR = (endValue / startValue)^(1 / years) - 1
```

Calculated over the full snapshot history.

### Max Drawdown

The largest peak-to-trough decline in portfolio value across all snapshots.

```
Drawdown = (peak - trough) / peak
Max Drawdown = max(Drawdown) across all time
```

### Year-to-Date Return

Percentage gain from the last snapshot of the previous year to the most recent snapshot.

---

## Benchmarks

The system tracks three benchmark indices for comparison in the Performance page:

| ID | Name |
|----|------|
| `sp500` | S&P 500 |
| `merval` | Merval (BYMA) |
| `nasdaq` | Nasdaq 100 |

Stored as `BenchmarkPoint { benchmarkId, date, value }`. Used to normalize and overlay performance charts.

---

## Retirement Planning

### Retirement Goal (Required Capital)

```
Required Capital = Annual Expenses / Withdrawal Rate
```

Example: $1200/month × 12 = $14400/year; at 4% withdrawal rate → $360,000 required.

### Projection Curve

Deterministic future value model:

```
FV(n) = (currentPortfolio + monthlyContribution/r) × (1+r)^n - monthlyContribution/r
```

Where `r` is the expected monthly real return.

### Monte Carlo Simulation

Runs N simulations (typically 1000+) sampling random annual returns from a normal distribution defined by expected return and standard deviation.

Returns:
- Percentile bands (P10, P25, P50, P75, P90)
- Probability of reaching the retirement goal by the target date

---

## Real Gains (Ganancia Real USD)

Decomposes ARS portfolio gains into:

1. **Underlying appreciation** — USD gain of the stock itself:
   ```
   underlyingGainUsd = (currentPriceUsd - entryPriceUsd) × sharesEquivalent
   ```

2. **CCL impact** — how much of the ARS gain is just peso devaluation:
   ```
   cclImpact = value_ars_current / ccl_current - value_ars_cost / ccl_at_purchase
   ```

Uses `HistoricalPriceCache` (Yahoo Finance USD prices) and `ExchangeRate` records.

---

## Price Caches

### MarketPriceCache

Stores the most recent market price for each ticker (ARS or USD). Updated via the "Actualizar precios" button in Assets.

### HistoricalPriceCache

Stores daily historical USD prices per ticker for underlying stocks. Used in the Real Gains calculation. Populated via Yahoo Finance API.

---

## Key Principles

1. **Historical data is immutable.** Snapshots, once imported, are never modified.
2. **Reproducibility.** All calculations must produce the same result given the same snapshot data.
3. **Separation of ARS and USD.** Always be explicit about the currency of any value.
4. **CCL is the bridge.** Any ARS↔USD conversion uses the CCL recorded at the snapshot date, not today's rate.
5. **CEDEAR ratio is required** for any calculation involving the underlying stock.
