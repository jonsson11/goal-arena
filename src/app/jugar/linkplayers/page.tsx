// src/app/jugar/linkplayers/page.tsx
"use client";

import { LinkPlayersGame } from "@/features/games/linkplayers/LinkPlayersGame";
import { GameLauncher } from "@/features/games/shared/GameLauncher";

// Etiquetas del selector de dificultad propias de LinkPlayers -- petición
// del usuario (12/08/2026): en vez de "Fácil/Medio/Difícil", mostrar
// directamente el rango de jugadores intermedios de cada nivel ("la
// dificultad radicará en el conocimiento del jugador", no en una palabra
// abstracta). Los números deben coincidir con RANGO_STEPS_POR_DIFICULTAD
// en generarPartida.server.ts, MENOS 1 en cada extremo (esa constante
// cuenta Steps/conexiones; la UI habla en jugadores intermedios, ver
// LinkPlayersGame.tsx): facil 2-3 Steps -> 1-2, medio 4-5 -> 3-4, dificil
// 6-8 -> 5-7. No se puede importar la constante del servidor directamente
// aquí (arrastraría código de Prisma a un componente cliente), así que
// esta lista es la fuente de la verdad para la UI y debe actualizarse a
// mano si ese rango cambia.
const OPCIONES_DIFICULTAD_LINKPLAYERS = [
  { valor: "facil" as const, etiqueta: "1-2 pasos", pista: "Mejor respuesta = 1 o 2 jugadores." },
  { valor: "medio" as const, etiqueta: "3-4 pasos", pista: "Mejor respuesta = 3 o 4 jugadores." },
  { valor: "dificil" as const, etiqueta: "5-7 pasos", pista: "Mejor respuesta = 5 o 7 jugadores." },
];

export default function LinkPlayersPage() {
  return (
    <GameLauncher href="/jugar/linkplayers" dificultades opcionesDificultad={OPCIONES_DIFICULTAD_LINKPLAYERS}>
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
              LinkPlayers
            </h1>

            <p className="relative max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base">
              Conecta al jugador inicial con el final a través de excompañeros de
              club, con el menor número de jugadores intermedios posible. Puedes
              revertir el último jugador en cualquier momento si se te ocurre un
              camino mejor.
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
