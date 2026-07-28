/*
  Warnings:

  - You are about to drop the column `imageUrl` on the `Player` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Player" DROP COLUMN "imageUrl",
ADD COLUMN     "imagenUrl" TEXT;
