-- DropIndex
DROP INDEX IF EXISTS "Category_userId_name_key";

-- CreateIndex
CREATE UNIQUE INDEX "Category_userId_familyId_name_key" ON "Category"("userId", "familyId", "name");
