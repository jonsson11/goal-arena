"use client";

// src/components/home/GamesCarousel.tsx
//
// Rediseño "lomo de color" (Fase 10, 19/08/2026): antes esta tarjeta era
// su propio diseño suelto (icono grande centrado, botón "Jugar ahora"
// aparte) que no se parecía en nada a las tarjetas de /jugar tras el
// rediseño de menús. En vez de mantener un segundo diseño de tarjeta de
// juego para mantener sincronizado a mano, el carrusel ahora renderiza
// literalmente el mismo componente `JuegoCromo` que usa /jugar -- así
// cualquier cambio futuro en el diseño de esas tarjetas (imagen, colores,
// insignias...) se refleja aquí automáticamente, sin tener que tocar dos
// sitios. Los controles de flechas y puntos de abajo son lo único propio
// del carrusel.

import { useEffect, useState } from "react";
import { JUEGOS } from "@/features/games/shared/juegos";
import { JuegoCromo } from "@/features/games/shared/JuegoCromo";

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

  const { Icono, ...juego } = JUEGOS[indice];

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

        <div className="flex-1">
          <JuegoCromo juego={juego} icono={<Icono className="h-4 w-4" />} />
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