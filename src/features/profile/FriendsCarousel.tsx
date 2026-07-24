"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Amigo } from "@/features/social/type";

type FriendsCarouselProps = {
  amigos: Amigo[];
};

export function FriendsCarousel({ amigos }: FriendsCarouselProps) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (amigos.length <= 1) return;

    const intervalo = setInterval(() => {
      setIndice((actual) => (actual + 1) % amigos.length);
    }, 3500);

    return () => clearInterval(intervalo);
  }, [amigos.length]);

  if (amigos.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border bg-card/50 p-8 text-center">
        <span className="text-4xl">👥</span>
        <p className="text-sm font-semibold text-foreground">
          Todavía no tienes amigos agregados
        </p>
        <p className="text-xs text-muted-foreground">
          Añade amigos para comparar estadísticas y retarles directamente.
        </p>
        <Link
          href="/social"
          className="mt-2 rounded-md bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        >
          Ir a Social
        </Link>
      </div>
    );
  }

  const amigo = amigos[indice];

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => setIndice((i) => (i - 1 + amigos.length) % amigos.length)}
        aria-label="Amigo anterior"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary hover:text-primary"
      >
        ‹
      </button>

      <Link
        href={`/perfil/${amigo.nombre.toLowerCase()}`}
        className="flex flex-1 items-center gap-4 rounded-xl border border-border bg-card px-5 py-3 transition-colors hover:border-primary/40"
      >
        <div className="relative flex h-12 w-12 flex-none items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-2xl">
          {amigo.avatar}
          <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${amigo.enLinea ? "bg-primary" : "bg-destructive"}`}/>
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold text-foreground">{amigo.nombre}</span>
          <span className="text-xs text-muted-foreground">Nivel {amigo.nivel}</span>
        </div>
      </Link>

      <button
        onClick={() => setIndice((i) => (i + 1) % amigos.length)}
        aria-label="Siguiente amigo"
        className="flex h-8 w-8 flex-none items-center justify-center rounded-full border border-border bg-card text-foreground transition-colors hover:border-primary hover:text-primary"
      >
        ›
      </button>
    </div>
  );
}