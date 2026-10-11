-- CreateTable
CREATE TABLE "cedear_ratio_changes" (
    "id" TEXT NOT NULL,
    "ticker" TEXT NOT NULL,
    "effectiveDate" DATE NOT NULL,
    "oldRatio" DECIMAL(8,4) NOT NULL,
    "newRatio" DECIMAL(8,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cedear_ratio_changes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "cedear_ratio_changes_ticker_effectiveDate_key" ON "cedear_ratio_changes"("ticker", "effectiveDate");

-- Split del CEDEAR SPY informado por BYMA (20:1 → 60:1, 2 CEDEARs adicionales
-- por cada uno), acreditado entre el 29/05 y el 01/06/2026.
INSERT INTO "cedear_ratio_changes" ("id", "ticker", "effectiveDate", "oldRatio", "newRatio")
VALUES ('ratio_spy_20260601', 'SPY', '2026-06-01', 20, 60)
ON CONFLICT ("ticker", "effectiveDate") DO NOTHING;
