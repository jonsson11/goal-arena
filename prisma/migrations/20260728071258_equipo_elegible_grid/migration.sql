-- AlterTable
ALTER TABLE "Team" ADD COLUMN     "elegibleParaGrid" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "Team_elegibleParaGrid_idx" ON "Team"("elegibleParaGrid");
