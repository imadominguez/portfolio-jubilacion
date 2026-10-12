-- CreateTable
CREATE TABLE "cedear_listing_versions" (
    "version" DATE NOT NULL,
    "sourceUrl" TEXT NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cedear_listing_versions_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "cedear_listings" (
    "ticker" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "market" TEXT NOT NULL,
    "ratioCedear" DECIMAL(10,4) NOT NULL,
    "ratioUnderlying" DECIMAL(10,4) NOT NULL,
    "version" DATE NOT NULL,

    CONSTRAINT "cedear_listings_pkey" PRIMARY KEY ("ticker")
);

-- CreateIndex
CREATE INDEX "cedear_listings_version_idx" ON "cedear_listings"("version");

-- AddForeignKey
ALTER TABLE "cedear_listings" ADD CONSTRAINT "cedear_listings_version_fkey" FOREIGN KEY ("version") REFERENCES "cedear_listing_versions"("version") ON DELETE CASCADE ON UPDATE CASCADE;

