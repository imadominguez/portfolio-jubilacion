-- CreateEnum
CREATE TYPE "AlertKind" AS ENUM ('PRICE_DROP', 'REMINDER');

-- CreateTable
CREATE TABLE "alert_settings" (
    "userId" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "dropFromHighPct" DECIMAL(5,2) NOT NULL DEFAULT 15,
    "weeklyDropPct" DECIMAL(5,2) NOT NULL DEFAULT 8,
    "reminderDay" INTEGER NOT NULL DEFAULT 5,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "alert_settings_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "alert_logs" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "AlertKind" NOT NULL,
    "key" TEXT NOT NULL,
    "value" DECIMAL(8,2),
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "alert_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "alert_logs_userId_kind_key_sentAt_idx" ON "alert_logs"("userId", "kind", "key", "sentAt");

-- AddForeignKey
ALTER TABLE "alert_settings" ADD CONSTRAINT "alert_settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "alert_logs" ADD CONSTRAINT "alert_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

