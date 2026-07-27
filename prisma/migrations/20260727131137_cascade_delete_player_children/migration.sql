-- DropForeignKey
ALTER TABLE "PlayerStat" DROP CONSTRAINT "PlayerStat_playerId_fkey";

-- DropForeignKey
ALTER TABLE "Stint" DROP CONSTRAINT "Stint_playerId_fkey";

-- DropForeignKey
ALTER TABLE "Top10Entry" DROP CONSTRAINT "Top10Entry_rankingId_fkey";

-- AddForeignKey
ALTER TABLE "Stint" ADD CONSTRAINT "Stint_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlayerStat" ADD CONSTRAINT "PlayerStat_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "Player"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Top10Entry" ADD CONSTRAINT "Top10Entry_rankingId_fkey" FOREIGN KEY ("rankingId") REFERENCES "Top10Ranking"("id") ON DELETE CASCADE ON UPDATE CASCADE;
