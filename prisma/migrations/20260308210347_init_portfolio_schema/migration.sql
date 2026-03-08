-- CreateEnum
CREATE TYPE "Currency" AS ENUM ('ARS', 'USD');

-- CreateTable
CREATE TABLE "portfolio_snapshots" (
    "id" TEXT NOT NULL,
    "snapshotDate" DATE NOT NULL,
    "totalValueArs" DECIMAL(18,2) NOT NULL,
    "totalValueUsd" DECIMAL(18,2),
    "ccl" DECIMAL(10,4),
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "portfolio_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "positions" (
    "id" TEXT NOT NULL,
    "snapshotId" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "instrumentName" TEXT,
    "quantity" DECIMAL(18,8) NOT NULL,
    "price" DECIMAL(18,4) NOT NULL,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "positionValue" DECIMAL(18,2) NOT NULL,
    "allocationPct" DECIMAL(8,6) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assets" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "instrumentName" TEXT,
    "cedearRatio" DECIMAL(8,4) NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "exchange_rates" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "ccl" DECIMAL(10,4) NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "exchange_rates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "portfolio_snapshots_snapshotDate_key" ON "portfolio_snapshots"("snapshotDate");

-- CreateIndex
CREATE INDEX "portfolio_snapshots_snapshotDate_idx" ON "portfolio_snapshots"("snapshotDate");

-- CreateIndex
CREATE INDEX "positions_snapshotId_idx" ON "positions"("snapshotId");

-- CreateIndex
CREATE INDEX "positions_ticker_idx" ON "positions"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "positions_snapshotId_ticker_key" ON "positions"("snapshotId", "ticker");

-- CreateIndex
CREATE UNIQUE INDEX "assets_ticker_key" ON "assets"("ticker");

-- CreateIndex
CREATE INDEX "assets_ticker_idx" ON "assets"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "exchange_rates_date_key" ON "exchange_rates"("date");

-- CreateIndex
CREATE INDEX "exchange_rates_date_idx" ON "exchange_rates"("date");

-- AddForeignKey
ALTER TABLE "positions" ADD CONSTRAINT "positions_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "portfolio_snapshots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
