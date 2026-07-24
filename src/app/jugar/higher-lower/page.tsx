import { HigherLowerGame } from "@/features/games/higher-lower/HigherLowerGame";
import { GamePageHeader } from "@/features/games/shared/GamePageHeader";
import { JUEGOS } from "@/features/games/shared/juegos";

const juego = JUEGOS.find((j) => j.href === "/jugar/higher-lower")!;

export default function HigherLowerPage() {
  return (
    <>
      <GamePageHeader juego={juego} />
      <HigherLowerGame />
    </>
  );
}