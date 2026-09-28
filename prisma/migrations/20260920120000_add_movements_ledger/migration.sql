-- CreateEnum
CREATE TYPE "MovementCategory" AS ENUM ('TRADE_BUY', 'TRADE_SELL', 'FCI_SUBSCRIPTION', 'FCI_REDEMPTION', 'PAYMENT', 'RECEIPT', 'DIVIDEND', 'DIVIDEND_IN_KIND', 'CONVERSION', 'OTHER');

-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "movementId" TEXT;

-- CreateTable
CREATE TABLE "movements" (
    "id" TEXT NOT NULL,
    "nroTicket" TEXT NOT NULL,
    "nroComprobante" TEXT,
    "date" DATE NOT NULL,
    "settlementDate" DATE,
    "rawType" TEXT NOT NULL,
    "category" "MovementCategory" NOT NULL,
    "instrument" TEXT,
    "ticker" TEXT,
    "currency" "Currency" NOT NULL DEFAULT 'ARS',
    "market" TEXT,
    "quantity" DECIMAL(18,8),
    "price" DECIMAL(18,4),
    "grossAmount" DECIMAL(18,4),
    "commission" DECIMAL(18,2),
    "ddmm" DECIMAL(18,4),
    "iva" DECIMAL(18,4),
    "other" DECIMAL(18,4),
    "total" DECIMAL(18,2) NOT NULL,
    "sourceFile" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT,

    CONSTRAINT "movements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "movements_date_idx" ON "movements"("date");

-- CreateIndex
CREATE INDEX "movements_category_idx" ON "movements"("category");

-- CreateIndex
CREATE INDEX "movements_ticker_idx" ON "movements"("ticker");

-- CreateIndex
CREATE UNIQUE INDEX "movements_userId_nroTicket_key" ON "movements"("userId", "nroTicket");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_movementId_key" ON "transactions"("movementId");

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "movements"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "movements" ADD CONSTRAINT "movements_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
