# Portfolio Snapshots Skill

This skill defines how portfolio snapshots work.

Snapshots represent the state of the portfolio at a specific moment in time.

They are created by importing CSV files from the Cocos Capital broker.

---

## Snapshot Definition

A snapshot contains:

- snapshot_date
- positions
- quantities
- prices
- total portfolio value

Snapshots allow historical tracking of portfolio growth.

Example:

2026-01-01 → Portfolio value: 4,200,000  
2026-02-01 → Portfolio value: 4,450,000  
2026-03-01 → Portfolio value: 4,700,000

---

## Snapshot Data Structure

Each snapshot contains multiple positions.

Example:

Snapshot
├ Position MELI
├ Position META
├ Position NVDA
└ Position AAPL

Each position includes:

- ticker
- quantity
- price
- position_value

---

## Snapshot Import

Snapshots are created by importing CSV exports from Cocos Capital.

CSV fields may include:

- instrument
- ticker
- quantity
- price
- currency
- total_value

The system should parse the ticker symbol from the instrument name.

Example:

"CEDEAR MERCADOLIBRE INC. (MELI)"

Ticker = MELI

---

## Historical Tracking

Snapshots allow the system to calculate:

- portfolio growth
- performance over time
- asset allocation history

---

## Important Rules

1. Snapshots must be immutable.
2. Snapshots represent historical financial data.
3. The system must never modify past snapshots.
4. New snapshots are appended, not updated.
