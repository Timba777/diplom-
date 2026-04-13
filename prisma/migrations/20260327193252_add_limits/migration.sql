-- CreateEnum
CREATE TYPE "LimitPeriod" AS ENUM ('WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "LimitScope" AS ENUM ('TOTAL', 'CATEGORY');

-- CreateTable
CREATE TABLE "BudgetLimit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "period" "LimitPeriod" NOT NULL,
    "scope" "LimitScope" NOT NULL,
    "isBlocking" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoryId" INTEGER,
    "userId" INTEGER,
    "familyId" INTEGER,

    CONSTRAINT "BudgetLimit_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BudgetLimit_userId_idx" ON "BudgetLimit"("userId");

-- CreateIndex
CREATE INDEX "BudgetLimit_familyId_idx" ON "BudgetLimit"("familyId");

-- CreateIndex
CREATE INDEX "BudgetLimit_categoryId_idx" ON "BudgetLimit"("categoryId");

-- AddForeignKey
ALTER TABLE "BudgetLimit" ADD CONSTRAINT "BudgetLimit_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLimit" ADD CONSTRAINT "BudgetLimit_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BudgetLimit" ADD CONSTRAINT "BudgetLimit_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "FamilyGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
