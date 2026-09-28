-- DropIndex
DROP INDEX "target_allocations_ticker_key";

-- CreateIndex
CREATE UNIQUE INDEX "target_allocations_userId_ticker_key" ON "target_allocations"("userId", "ticker");
