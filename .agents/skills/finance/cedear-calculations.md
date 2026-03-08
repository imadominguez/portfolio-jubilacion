# CEDEAR Calculations Skill

This skill defines how to work with CEDEAR financial instruments in the portfolio dashboard.

## What are CEDEARs

CEDEARs (Certificados de Depósito Argentinos) represent foreign stocks traded in the Argentine stock market.

Each CEDEAR represents a fraction of an underlying stock traded in USD.

Examples of CEDEAR tickers:

- MELI
- AAPL
- NVDA
- META
- AMD
- GOOGL

## CEDEAR Price Relationship

The CEDEAR price in ARS is influenced by:

1. stock price in USD
2. CEDEAR ratio
3. exchange rate (CCL)

Approximate formula:

CEDEAR Price ≈ (Stock Price USD / Ratio) × CCL

Example:

Stock price = 200 USD  
Ratio = 10  
CCL = 1200 ARS

CEDEAR price ≈ (200 / 10) × 1200

## CEDEAR Ratio

Examples:

AAPL → 10:1  
NVDA → 24:1  
MELI → 2:1

The ratio must be stored in the database to support calculations.

## System Requirements

The system may store:

- ticker
- cedear_ratio
- stock_price_usd
- cedear_price_ars
- exchange_rate_ccl

These variables allow financial calculations and validation of pricing.

## Important Rule

CEDEAR ratios rarely change, but the system should allow updating them if needed.
