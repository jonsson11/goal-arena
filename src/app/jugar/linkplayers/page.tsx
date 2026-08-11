// src/app/jugar/linkplayers/page.tsx
"use client";

import { LinkPlayersGame } from "@/features/games/linkplayers/LinkPlayersGame";
import { GameLauncher } from "@/features/games/shared/GameLauncher";

export default function LinkPlayersPage() {
  return (
    <GameLauncher href="/jugar/linkplayers" dificultades>
      {(dificultad) => (
        <div className="flex flex-col items-center gap-8 px-4 pb-12 pt-8 sm:px-6">
          <header className="relative flex flex-col items-center gap-3 text-center">
            <div
              aria-hidden
              className="pointer-events-none absolute left-1/2 top-1/2 h-40 w-72 -translate-x-1/2 -translate-y-1/2 animate-pulse rounded-full bg-secondary/20 blur-3xl motion-reduce:animate-none"
            />

            <span className="relative rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
              Nuevo
            </span>

            <h1 className="text-shimmer relative bg-gradient-to-r from-secondary via-primary to-secondary bg-clip-text font-heading text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl">
              LINKPLAYERS
            </h1>

            <p className="relative max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Conecta al jugador inicial con el final a través de excompañeros de
              club, en el menor número de Steps posible. Puedes revertir un Step
              en cualquier momento si se te ocurre un camino mejor.
            </p>
          </header>

          <div className="w-full max-w-2xl rounded-2xl border border-secondary/40 bg-card shadow-[0_0_40px_-8px_rgba(29,122,156,0.35)]">
            <LinkPlayersGame dificultad={dificultad} />
          </div>
        </div>
      )}
    </GameLauncher>
  );
}
