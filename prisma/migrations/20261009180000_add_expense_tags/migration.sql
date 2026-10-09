-- CreateTable
CREATE TABLE "expense_tags" (
    "movementId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "note" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_tags_pkey" PRIMARY KEY ("movementId")
);

-- CreateIndex
CREATE INDEX "expense_tags_userId_idx" ON "expense_tags"("userId");

-- AddForeignKey
ALTER TABLE "expense_tags" ADD CONSTRAINT "expense_tags_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "movements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_tags" ADD CONSTRAINT "expense_tags_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

