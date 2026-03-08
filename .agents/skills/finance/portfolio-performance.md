# Portfolio Performance Skill

This skill defines how to calculate portfolio metrics and performance.

The system tracks the user's long-term investment portfolio.

## Portfolio Value

Portfolio value represents the total value of all positions.

Formula:

Portfolio Value = Sum(Position Values)

Example:

MELI → 87800  
META → 119340  
NVDA → 95000

Portfolio Value = 302140

---

## Position Value

Position Value = Quantity × Price

Example:

Quantity = 4  
Price = 21950

Position Value = 87800

---

## Asset Allocation

Asset allocation represents the percentage weight of each asset in the portfolio.

Formula:

Allocation % = Position Value / Portfolio Value

Example:

Portfolio Value = 1,000,000

MELI = 200,000 → 20%

Allocation helps identify concentration risk.

---

## Portfolio Performance

Performance measures portfolio growth over time.

Formula:

Performance % = (Current Value - Previous Value) / Previous Value

Example:

Previous Value = 4,000,000  
Current Value = 4,400,000

Performance = 10%

---

## USD Performance

The portfolio should also be evaluated in USD.

Formula:

Portfolio USD Value = Portfolio ARS Value / CCL

Example:

Portfolio ARS = 4,800,000  
CCL = 1200

Portfolio USD = 4000

Tracking USD performance helps evaluate real growth beyond inflation.

---

## Important Rules

1. Calculations must always use stored snapshot data.
2. Portfolio value must be reproducible from stored records.
3. Never overwrite historical data.
