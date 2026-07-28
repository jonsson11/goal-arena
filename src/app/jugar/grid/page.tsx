// src/app/jugar/grid/page.tsx
import { GridBoard } from "@/features/games/grid/GridBoard";
import { GameLauncher } from "@/features/games/shared/GameLauncher";
import { PlayerRequestBox } from "@/features/games/shared/PlayerRequestBox";

export default function GridPage() {
  return (
    <GameLauncher href="/jugar/grid">
      <div className="flex flex-col items-center gap-8 px-4 pb-12 pt-8 sm:px-6">
        <header className="relative flex flex-col items-center gap-3 text-center">
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-72 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-primary/20 blur-3xl motion-reduce:animate-none"
          />

          <span className="relative rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
            Beta
          </span>

          <h1 className="text-shimmer relative bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text font-heading text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
            3X3 GRID
          </h1>

          <p className="relative max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
            Este modo está en fase beta. Si echas en falta a algún jugador, cuéntanoslo con la
            cajita de aquí al lado — nos ayuda muchísimo a completar la base de datos.
          </p>
        </header>

        <div className="flex w-full max-w-4xl flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
          <div className="w-full max-w-md rounded-2xl border border-primary/40 bg-card shadow-[0_0_40px_-8px_rgba(74,222,154,0.35)]">
            <GridBoard />
          </div>

          <PlayerRequestBox className="w-full max-w-md lg:w-72 lg:shrink-0" />
        </div>
      </div>
    </GameLauncher>
  );
}