"use client";

import Link from "next/link";
import { DoorOpen, KeyRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";

const PARTICULAS = [
  { left: "8%", delay: "0s" },
  { left: "22%", delay: "2s" },
  { left: "40%", delay: "4s" },
  { left: "63%", delay: "1s" },
  { left: "78%", delay: "5s" },
  { left: "91%", delay: "3s" },
];

export default function MultijugadorPage() {
  const { usuario } = useAuth();

  if (!usuario) {
    return (
      <AuthGate
        icono="🎮"
        titulo="Juega con tus amigos"
        descripcion="Crea una cuenta o inicia sesión para crear una sala multijugador o unirte a la de un amigo."
        redirectTras="/multijugador"
        aspectos={["🎮 Salas de 2 a 8", "⏱️ Mismo reto, en directo", "🏆 Historial contra amigos"]}
      />
    );
  }

  return (
    <div className="relative overflow-hidden">
      {PARTICULAS.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="particula-flotante pointer-events-none fixed h-[3px] w-[3px] rounded-full bg-secondary opacity-35"
          style={{ left: p.left, animationDelay: p.delay }}
        />
      ))}

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-2 px-6 py-12">
        <h1
          className="text-shimmer bg-gradient-to-r from-secondary via-primary to-secondary bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
          style={{ textShadow: "0 0 30px rgba(29,122,156,0.35)" }}
        >
          Multijugador
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Enfréntate en directo a tus amigos, el mismo reto para todos.
        </p>

        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            href="/multijugador/crear"
            className="group flex flex-col items-center gap-3 rounded-2xl border border-secondary/30 bg-card p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-secondary hover:shadow-[0_0_40px_-8px_rgba(29,122,156,0.6)]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/15 text-secondary">
              <DoorOpen className="h-8 w-8" />
            </span>
            <span className="text-xl font-extrabold text-foreground">Crear sala</span>
            <span className="text-sm text-muted-foreground">
              Elige juego y dificultad, invita a tus amigos con un código.
            </span>
          </Link>

          <Link
            href="/multijugador/unirse"
            className="group flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-card p-8 text-center transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-[0_0_40px_-8px_rgba(74,222,154,0.6)]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15 text-primary">
              <KeyRound className="h-8 w-8" />
            </span>
            <span className="text-xl font-extrabold text-foreground">Unirse a sala</span>
            <span className="text-sm text-muted-foreground">
              Introduce el código que te ha pasado un amigo.
            </span>
          </Link>
        </div>
      </div>
    </div>
  );
}