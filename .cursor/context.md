# Project Context

## Overview

This project is a **personal financial dashboard** used to manage and analyze a long-term investment portfolio.

The dashboard is designed for **private use** and focuses on tracking investments in **CEDEARs (Certificados de Depósito Argentinos)** purchased through **Cocos Capital**.

The main goal of the system is to provide visibility into:

- current portfolio value
- asset allocation
- performance over time
- historical growth
- performance in ARS and USD
- long-term retirement planning

The application should prioritize **accuracy, simplicity, and long-term historical tracking**.

---

# Data Source

The portfolio data comes from **CSV exports from Cocos Capital**.

These CSV files represent **snapshots of the portfolio at a specific point in time**, not individual trade operations.

Example snapshot:

- instrument name
- ticker symbol
- quantity
- price
- currency
- total position value

The system must import these snapshots and store them historically.

Snapshots should **never be modified or overwritten**, because they represent the historical state of the portfolio.

---

# Core Domain Concepts

## Portfolio

Represents the entire investment portfolio of the user.

It is composed of multiple positions and historical snapshots.

---

## Position

A position represents a holding of a specific financial instrument.

Example:

- MELI
- AAPL
- NVDA
- META

Each position contains:

- ticker
- quantity
- current value
- portfolio allocation %

---

## Snapshot

A snapshot represents the **state of the portfolio at a specific moment in time**.

Snapshots are created by importing CSV exports from Cocos Capital.

Example:

2026-01-01 → Portfolio value: $4,200,000
2026-02-01 → Portfolio value: $4,450,000
2026-03-01 → Portfolio value: $4,700,000

Snapshots allow the system to calculate:

- historical portfolio value
- performance over time
- growth trends

---

# CEDEAR Financial Concepts

CEDEARs represent foreign stocks traded in the Argentine market.

Their price is influenced by:

1. underlying stock price in USD
2. CEDEAR ratio
3. Argentine exchange rate (CCL)

Approximate formula:

CEDEAR Price ≈ (Stock Price USD / Ratio) \* CCL

Example:

AAPL price = 200 USD
CEDEAR ratio = 10:1
CCL = 1200 ARS

CEDEAR price ≈ (200 / 10) \* 1200

Understanding this relationship is important when calculating portfolio metrics.

---

# Portfolio Metrics

The dashboard should calculate the following metrics.

## Portfolio Value

Total value of all positions in the portfolio.

---

## Asset Allocation

Percentage of the portfolio allocated to each asset.

Example:

MELI → 22%
META → 18%
NVDA → 15%

---

## Historical Growth

Portfolio value across time using snapshots.

Displayed using time series charts.

---

## Performance

Performance can be measured in:

- ARS (Argentine Pesos)
- USD (US Dollars)

This allows the user to understand real performance relative to currency devaluation.

---

# Dashboard Sections

The application should include the following main sections.

## Overview

Displays key portfolio metrics:

- total portfolio value
- total gain/loss
- percentage performance
- number of positions

---

## Holdings

A table showing all current positions.

Columns may include:

- ticker
- quantity
- price
- position value
- allocation %

---

## Portfolio Performance

Charts showing:

- portfolio value over time
- historical growth

---

## Asset Allocation

Visualizations showing how the portfolio is distributed across assets.

---

# Long-Term Goal

The long-term goal of the project is to help the user manage a **retirement investment portfolio** and track progress toward financial independence.

The system should help answer questions like:

- How much is the portfolio worth today?
- How fast is the portfolio growing?
- Which assets represent the largest allocation?
- How does performance look over time?

The system should remain simple, reliable, and focused on long-term investing.
