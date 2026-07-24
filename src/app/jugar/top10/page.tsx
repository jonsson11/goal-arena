import { Top10Game } from "@/features/games/top10/Top10Game";
import { GameLauncher } from "@/features/games/shared/GameLauncher";

export default function Top10Page() {
  return (
    <GameLauncher href="/jugar/top10">
      <Top10Game />
    </GameLauncher>
  );
}