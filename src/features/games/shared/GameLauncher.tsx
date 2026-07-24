"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { JUEGOS } from "./juegos";
import { GameButton } from "./GameButton";

type GameLauncherProps = {
  href: string;
  children: ReactNode;
};

export function GameLauncher({ href, children }: GameLauncherProps) {
  const [empezado, setEmpezado] = useState(false);
  const juego = JUEGOS.find((j) => j.href === href)!;
  const { Icono, nombre, descripcion, acento } = juego;

  if (empezado) {
    return <>{children}</>;
  }

  return (
    <div className="flex flex-col items-center gap-4 px-6 pt-10 pb-10 text-center">
      <Link
        href="/jugar"
        className="text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
      >
        ‹ Volver a Jugar
      </Link>

      <div
        className={`flex h-20 w-20 items-center justify-center rounded-2xl border ${
          acento === "primary"
            ? "border-primary/40 bg-primary/10 shadow-[0_0_30px_-6px_rgba(74,222,154,0.5)]"
            : "border-secondary/40 bg-secondary/10 shadow-[0_0_30px_-6px_rgba(29,122,156,0.6)]"
        }`}
      >
        <Icono
          className={`h-10 w-10 ${acento === "primary" ? "text-primary" : "text-secondary"}`}
        />
      </div>

      <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
        {nombre}
      </h1>

      <p className="max-w-md text-sm text-muted-foreground sm:text-base">{descripcion}</p>

      <GameButton onClick={() => setEmpezado(true)} className="mt-2 px-8 py-3 text-base">
        Empezar partida
      </GameButton>
    </div>
  );
}