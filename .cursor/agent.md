# AI Agent Context

This project is a personal financial dashboard used to manage a long-term investment portfolio focused on CEDEARs.

The system is designed to import portfolio snapshots from Cocos Capital CSV exports and track the evolution of the portfolio over time.

The goal of the project is to provide insights into:

- Portfolio value
- Historical growth
- Asset allocation
- Performance in ARS and USD
- Long-term retirement planning

The system should prioritize simplicity, maintainability and strong data modeling.

---

# Tech Stack

Frontend:

- Next.js 16 (App Router)
- shadcn/ui
- TailwindCSS
- Zustand

Backend:

- Next.js Server Actions

Database:

- PostgreSQL
- Prisma ORM

Data sources:

- CSV portfolio exports from Cocos Capital
- Market price APIs
- Exchange rate data (CCL)

---

# Architecture Principles

The application should follow these principles:

- clean and modular architecture
- domain-oriented data modeling
- separation between domain logic and UI
- server-side data processing
- strongly typed models

---

# Core Domain Concepts

Portfolio
Position
Snapshot
PriceHistory
ExchangeRate
Dividend

Snapshots represent the state of the portfolio at a given moment in time.

The system should allow importing snapshots from CSV files and calculating portfolio metrics.

---

# Expected Capabilities

The agent should help with:

- designing Prisma schemas
- building dashboard UI
- implementing financial calculations
- parsing CSV files
- managing portfolio snapshots
- creating data visualizations
