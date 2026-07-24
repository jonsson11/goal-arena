import { GridBoard } from "@/features/games/grid/GridBoard";
import { GamePageHeader } from "@/features/games/shared/GamePageHeader";
import { JUEGOS } from "@/features/games/shared/juegos";

const juego = JUEGOS.find((j) => j.href === "/jugar/grid")!;

export default function GridPage() {
  return (
    <>
      <GamePageHeader juego={juego} />
      <GridBoard />
    </>
  );
}