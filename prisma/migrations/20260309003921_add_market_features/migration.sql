-- CreateEnum
CREATE TYPE "TransactionType" AS ENUM ('BUY', 'SELL');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "country" TEXT,
ADD COLUMN     "industry" TEXT,
ADD COLUMN     "sector" TEXT,
ADD COLUMN     "underlyingTicker" TEXT;

-- CreateTable
CREATE TABLE "market_price_cache" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "market_price_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "benchmark_points" (
    "id" TEXT NOT NULL,
    "benchmarkId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "value" DECIMAL(18,6) NOT NULL,

    CONSTRAINT "benchmark_points_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "target_allocations" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "targetPct" DECIMAL(8,6) NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "target_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "type" "TransactionType" NOT NULL,
    "quantity" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "fee" DECIMAL(18,2),
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dividends" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'USD',
    "date" DATE NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "dividends_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "retirement_settings" (
    "id" TEXT NOT NULL,
    "currentAge" INTEGER NOT NULL,
    "retirementAge" INTEGER NOT NULL,
    "monthlyExpensesUsd" DECIMAL(18,2) NOT NULL,
    "inflationRate" DECIMAL(6,4) NOT NULL,
    "withdrawalRate" DECIMAL(6,4) NOT NULL,
    "monthlyContribution" DECIMAL(18,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "retirement_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "milestone_alerts" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "targetValueUsd" DECIMAL(18,2) NOT NULL,
    "reached" BOOLEAN NOT NULL DEFAULT false,
    "reachedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "milestone_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "market_price_cache_ticker_key" ON "market_price_cache"("ticker");

-- CreateIndex
CREATE INDEX "market_price_cache_ticker_idx" ON "market_price_cache"("ticker");

-- CreateIndex
CREATE INDEX "benchmark_points_benchmarkId_date_idx" ON "benchmark_points"("benchmarkId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "benchmark_points_benchmarkId_date_key" ON "benchmark_points"("benchmarkId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "target_allocations_ticker_key" ON "target_allocations"("ticker");

-- CreateIndex
CREATE INDEX "transactions_ticker_idx" ON "transactions"("ticker");

-- CreateIndex
CREATE INDEX "transactions_date_idx" ON "transactions"("date");

-- CreateIndex
CREATE INDEX "dividends_ticker_idx" ON "dividends"("ticker");

-- CreateIndex
CREATE INDEX "dividends_date_idx" ON "dividends"("date");
