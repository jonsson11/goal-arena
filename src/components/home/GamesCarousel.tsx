"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { JUEGOS } from "@/features/games/shared/juegos";

export function GamesCarousel() {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndice((actual) => (actual + 1) % JUEGOS.length);
    }, 4000);

    return () => clearInterval(intervalo);
  }, []);

  function anterior() {
    setIndice((actual) => (actual - 1 + JUEGOS.length) % JUEGOS.length);
  }

  function siguiente() {
    setIndice((actual) => (actual + 1) % JUEGOS.length);
  }

  const juego = JUEGOS[indice];
  const { Icono } = juego;

  return (
    <section className="flex flex-col items-center gap-8 px-6 py-16">
      <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
        Elige tu reto
      </h2>

      <div className="flex w-full max-w-md items-center gap-4">
        <button
          onClick={anterior}
          aria-label="Juego anterior"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          ‹
        </button>

        <div
          className={`flex flex-1 flex-col items-center gap-4 rounded-2xl border bg-card p-10 text-center transition-all duration-300 ${
            juego.acento === "primary"
              ? "border-primary/30 shadow-[0_0_30px_-4px_rgba(74,222,154,0.4)]"
              : "border-secondary/30 shadow-[0_0_30px_-4px_rgba(29,122,156,0.5)]"
          }`}
        >
          <Icono
            className={`h-16 w-16 ${
              juego.acento === "primary" ? "text-primary" : "text-secondary"
            }`}
          />
          <span
            className={`text-xl font-bold ${
              juego.acento === "primary" ? "text-primary" : "text-secondary"
            }`}
          >
            {juego.nombre}
          </span>
          <span className="text-sm text-muted-foreground">{juego.descripcion}</span>

          <Link
            href={juego.href}
            className="mt-2 rounded-md bg-primary px-6 py-2 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Jugar ahora
          </Link>
        </div>

        <button
          onClick={siguiente}
          aria-label="Siguiente juego"
          className="flex h-10 w-10 flex-none items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary hover:text-primary"
        >
          ›
        </button>
      </div>

      <div className="flex gap-2">
        {JUEGOS.map((_, i) => (
          <button
            key={i}
            onClick={() => setIndice(i)}
            aria-label={`Ir al juego ${i + 1}`}
            className={`h-2 w-2 rounded-full transition-all ${
              i === indice ? "w-6 bg-primary" : "bg-muted-foreground/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
}