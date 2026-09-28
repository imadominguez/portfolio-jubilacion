-- CreateEnum
CREATE TYPE "AssetKind" AS ENUM ('CEDEAR', 'FCI', 'OTHER');

-- AlterTable
ALTER TABLE "assets" ADD COLUMN     "assetKind" "AssetKind" NOT NULL DEFAULT 'CEDEAR';

-- CreateIndex
CREATE INDEX "assets_assetKind_idx" ON "assets"("assetKind");
