/*
  Warnings:

  - You are about to drop the column `body` on the `notes` table. All the data in the column will be lost.
  - You are about to drop the column `title` on the `notes` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "notes" DROP COLUMN "body",
DROP COLUMN "title",
ADD COLUMN     "tags" TEXT[] DEFAULT ARRAY[]::TEXT[];
