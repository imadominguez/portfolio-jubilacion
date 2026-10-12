-- CreateEnum
CREATE TYPE "AssetSource" AS ENUM ('MANUAL', 'AUTO');

-- CreateEnum
CREATE TYPE "AssetRequestStatus" AS ENUM ('PENDING', 'RUNNING', 'DONE', 'NEEDS_REVIEW', 'FAILED');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "source" "AssetSource" NOT NULL DEFAULT 'MANUAL';

-- CreateTable
CREATE TABLE "asset_requests" (
    "ticker" TEXT NOT NULL,
    "instrumentName" TEXT,
    "observedPrice" DECIMAL(18,4),
    "observedCurrency" "Currency",
    "observedCcl" DECIMAL(18,4),
    "observedAt" DATE,
    "requestedBy" TEXT,
    "status" "AssetRequestStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "proposal" JSONB,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "asset_requests_pkey" PRIMARY KEY ("ticker")
);

-- CreateIndex
CREATE INDEX "asset_requests_status_idx" ON "asset_requests"("status");

