-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "AlertKind" ADD VALUE 'MONTHLY_REPORT';
ALTER TYPE "AlertKind" ADD VALUE 'MONTHLY_SUMMARY';

-- AlterTable
ALTER TABLE "alert_settings" ADD COLUMN     "monthlyReport" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "monthlySummary" BOOLEAN NOT NULL DEFAULT true;

