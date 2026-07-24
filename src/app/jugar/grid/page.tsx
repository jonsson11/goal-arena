import { GridBoard } from "@/features/games/grid/GridBoard";
import { GameLauncher } from "@/features/games/shared/GameLauncher";

export default function GridPage() {
  return (
    <GameLauncher href="/jugar/grid">
      <GridBoard />
    </GameLauncher>
  );
}