/*
  Warnings:

  - A unique constraint covering the columns `[codigo]` on the table `Competition` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[rankingId,playerId]` on the table `Top10Entry` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[competitionId,temporada,metrica]` on the table `Top10Ranking` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `updatedAt` to the `Top10Ranking` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "Top10Metrica" AS ENUM ('GOLES', 'ASISTENCIAS', 'PARTIDOS', 'VALOR_MERCADO');

-- CreateEnum
CREATE TYPE "Top10Fuente" AS ENUM ('API', 'MANUAL');

-- AlterTable
ALTER TABLE "Competition" ADD COLUMN     "codigo" TEXT;

-- AlterTable
ALTER TABLE "Player" ADD COLUMN     "alias" TEXT[] DEFAULT ARRAY[]::TEXT[];

-- AlterTable
ALTER TABLE "Top10Entry" ADD COLUMN     "equipoTexto" TEXT,
ADD COLUMN     "valor" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Top10Ranking" ADD COLUMN     "activo" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "fuente" "Top10Fuente" NOT NULL DEFAULT 'API',
ADD COLUMN     "metrica" "Top10Metrica" NOT NULL DEFAULT 'GOLES',
ADD COLUMN     "temporada" TEXT,
ADD COLUMN     "totalEntradas" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Competition_codigo_key" ON "Competition"("codigo");

-- CreateIndex
CREATE UNIQUE INDEX "Top10Entry_rankingId_playerId_key" ON "Top10Entry"("rankingId", "playerId");

-- CreateIndex
CREATE INDEX "Top10Ranking_activo_idx" ON "Top10Ranking"("activo");

-- CreateIndex
CREATE UNIQUE INDEX "Top10Ranking_competitionId_temporada_metrica_key" ON "Top10Ranking"("competitionId", "temporada", "metrica");
