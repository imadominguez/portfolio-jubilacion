-- CreateEnum
CREATE TYPE "RatioProposalStatus" AS ENUM ('PENDING', 'APPLIED', 'DISMISSED');

-- CreateTable
CREATE TABLE "ratio_change_proposals" (
    "ticker" TEXT NOT NULL,
    "newRatio" DECIMAL(10,4) NOT NULL,
    "oldRatio" DECIMAL(10,4) NOT NULL,
    "listingVersion" DATE NOT NULL,
    "status" "RatioProposalStatus" NOT NULL DEFAULT 'PENDING',
    "detectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "ratio_change_proposals_pkey" PRIMARY KEY ("ticker","newRatio")
);

-- CreateIndex
CREATE INDEX "ratio_change_proposals_status_idx" ON "ratio_change_proposals"("status");

