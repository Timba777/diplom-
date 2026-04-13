/*
  Warnings:

  - A unique constraint covering the columns `[familyId,userId]` on the table `FamilyMember` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "FamilyMember_familyId_userId_key" ON "FamilyMember"("familyId", "userId");
