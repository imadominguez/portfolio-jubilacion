-- CreateTable
CREATE TABLE "user_setup" (
    "userId" TEXT NOT NULL,
    "onboardingCompletedAt" TIMESTAMP(3),
    "onboardingDismissedAt" TIMESTAMP(3),
    "lastStep" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_setup_pkey" PRIMARY KEY ("userId")
);

-- AddForeignKey
ALTER TABLE "user_setup" ADD CONSTRAINT "user_setup_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
