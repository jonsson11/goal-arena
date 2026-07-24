import { Top10Game } from "@/features/games/top10/Top10Game";
import { GamePageHeader } from "@/features/games/shared/GamePageHeader";
import { JUEGOS } from "@/features/games/shared/juegos";

const juego = JUEGOS.find((j) => j.href === "/jugar/top10")!;

export default function Top10Page() {
  return (
    <>
      <GamePageHeader juego={juego} />
      <Top10Game />
    </>
  );
}