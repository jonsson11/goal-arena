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
    <div className="flex flex-col items-center gap-6 px-6 pt-10 pb-10">
      <Link
        href="/jugar"
        className="self-start text-sm font-semibold text-muted-foreground transition-colors hover:text-primary sm:self-center"
      >
        ‹ Volver a Jugar
      </Link>

      <div className="flex w-full max-w-md flex-col items-center gap-4 rounded-2xl border border-primary/40 bg-card p-8 text-center shadow-[0_0_40px_-8px_rgba(74,222,154,0.5)]">
        <div
          className={`flex h-20 w-20 items-center justify-center rounded-2xl border ${
            acento === "primary"
              ? "border-primary/40 bg-primary/10"
              : "border-secondary/40 bg-secondary/10"
          }`}
        >
          <Icono
            className={`h-10 w-10 ${acento === "primary" ? "text-primary" : "text-secondary"}`}
          />
        </div>

        <h1 className="text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
          {nombre}
        </h1>

        <p className="text-base leading-relaxed text-foreground/80 sm:text-lg">
          {descripcion}
        </p>

        <GameButton
          onClick={() => setEmpezado(true)}
          className="mt-2 w-full py-4 font-heading text-lg font-bold tracking-wide"
        >
          Empezar partida
        </GameButton>
      </div>
    </div>
  );
}