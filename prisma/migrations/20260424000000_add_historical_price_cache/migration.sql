-- CreateTable
CREATE TABLE "historical_price_cache" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "priceUsd" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "historical_price_cache_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "historical_price_cache_ticker_date_key" ON "historical_price_cache"("ticker", "date");

-- CreateIndex
CREATE INDEX "historical_price_cache_ticker_idx" ON "historical_price_cache"("ticker");
