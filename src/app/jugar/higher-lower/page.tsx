import { HigherLowerGame } from "@/features/games/higher-lower/HigherLowerGame";
import { GameLauncher } from "@/features/games/shared/GameLauncher";

export default function HigherLowerPage() {
  return (
    <GameLauncher href="/jugar/higher-lower">
      <HigherLowerGame />
    </GameLauncher>
  );
}