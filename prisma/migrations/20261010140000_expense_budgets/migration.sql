-- AlterEnum
ALTER TYPE "AlertKind" ADD VALUE 'BUDGET';

-- CreateTable
CREATE TABLE "expense_budgets" (
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amountArs" DECIMAL(18,2) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_budgets_pkey" PRIMARY KEY ("userId","category")
);

-- AddForeignKey
ALTER TABLE "expense_budgets" ADD CONSTRAINT "expense_budgets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

