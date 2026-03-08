# Domain Knowledge

This document describes the financial domain concepts used in the portfolio dashboard.

The system is designed to manage a personal investment portfolio focused on **CEDEARs** purchased through **Cocos Capital**.

Understanding these financial concepts is important for implementing correct calculations and data models.

---

# CEDEARs

CEDEARs (Certificados de Depósito Argentinos) are instruments that allow investors in Argentina to invest in foreign companies through the local stock market.

Each CEDEAR represents a fraction of an underlying stock traded in the United States.

Examples:

- MELI (MercadoLibre)
- AAPL (Apple)
- NVDA (Nvidia)
- META (Meta)

The CEDEAR price in Argentina is influenced by three variables:

1. underlying stock price in USD
2. CEDEAR ratio
3. Argentine financial exchange rate (CCL)

Approximate formula:

CEDEAR price ≈ (Stock price USD / CEDEAR ratio) × CCL

Example:

Stock price = 200 USD
CEDEAR ratio = 10:1
CCL = 1200 ARS

CEDEAR price ≈ (200 / 10) × 1200

---

# CEDEAR Ratio

The CEDEAR ratio defines how many CEDEARs represent one share of the underlying stock.

Examples:

AAPL → 10 CEDEARs = 1 share
NVDA → 24 CEDEARs = 1 share
MELI → 2 CEDEARs = 1 share

This ratio must be stored in the system because it is required to convert between:

- CEDEAR price in ARS
- underlying stock price in USD

---

# Exchange Rate (CCL)

The **CCL (Contado con Liquidación)** exchange rate represents the implicit USD price used in the Argentine financial market.

It is commonly used to estimate the USD value of CEDEARs.

Example:

If CCL = 1200 ARS
then:

1200 ARS ≈ 1 USD

The system may store historical CCL values to calculate portfolio value in USD.

---

# Portfolio Snapshot

A snapshot represents the **state of the portfolio at a specific moment in time**.

Snapshots are created by importing CSV files exported from Cocos Capital.

Each snapshot contains:

- date
- list of positions
- quantities
- prices
- total portfolio value

Snapshots are immutable records and should **never be modified**.

They are used to calculate historical portfolio performance.

---

# Position

A position represents the holdings of a specific asset in the portfolio.

Example:

Ticker: MELI
Quantity: 4
Price: 21950 ARS
Value: 87800 ARS

Each position contains:

- ticker
- quantity
- price
- position value
- portfolio allocation percentage

---

# Portfolio Value

Portfolio value represents the total value of all positions.

Formula:

Portfolio Value = Sum of all position values

Example:

MELI → 87800
META → 119340
NVDA → 95000

Total Portfolio Value = 302140

---

# Asset Allocation

Asset allocation represents how the portfolio is distributed across assets.

Formula:

Allocation % = Position Value / Total Portfolio Value

Example:

Portfolio Value = 1,000,000 ARS

MELI = 200,000 → 20%
META = 150,000 → 15%

Allocation helps identify concentration risk.

---

# Portfolio Performance

Performance measures how the portfolio grows over time.

Using snapshots:

Performance % = (Current Value - Previous Value) / Previous Value

Example:

January → 4,000,000
February → 4,400,000

Performance = 10%

---

# Performance in USD

Because the Argentine peso experiences high inflation and devaluation, portfolio performance should also be calculated in USD.

USD Value = Portfolio Value / CCL

Example:

Portfolio Value = 4,800,000 ARS
CCL = 1200

USD Value = 4000 USD

Tracking USD value allows the user to measure real investment growth.

---

# Dividend Income

Some CEDEARs distribute dividends.

Dividend data may include:

- ticker
- payment date
- gross dividend
- tax withholding
- net dividend received

Dividend tracking allows the system to calculate:

- annual dividend income
- dividend yield

---

# Long-Term Investing

This portfolio is intended for long-term investing with the goal of building retirement capital.

The system should prioritize:

- historical accuracy
- reliable calculations
- clear portfolio insights
- long-term performance tracking

The system is not intended for day trading or short-term speculation.

---

# Key Principles for the Domain

1. Financial data should never be overwritten.
2. Historical snapshots must remain immutable.
3. Calculations should always be reproducible.
4. Portfolio growth should be measurable over long time periods.
