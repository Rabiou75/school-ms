/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Guardian` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Guardian" ADD COLUMN     "userId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "Guardian_userId_key" ON "Guardian"("userId");

-- AddForeignKey
ALTER TABLE "Guardian" ADD CONSTRAINT "Guardian_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
