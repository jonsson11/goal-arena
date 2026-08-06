"use client";

import Link from "next/link";
import { DoorOpen, KeyRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { TituloPagina } from "@/components/layout/TituloPagina";

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
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      {/* Título (con el botón "Atrás" dentro) fuera de la columna centrada
          -- mismo motivo que en /jugar/page.tsx. */}
      <TituloPagina acento="azul" hrefAtras="/" className="mb-2">
        Multijugador
      </TituloPagina>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-2">
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Enfréntate en directo a tus amigos, el mismo reto para todos.
        </p>

        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
          <Link
            href="/multijugador/crear"
            className="group flex flex-col items-center gap-3 rounded-2xl border border-secondary/35 bg-secondary/[0.12] p-8 text-center backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-secondary hover:shadow-[0_8px_40px_-10px_rgba(29,122,156,0.6)]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-secondary/25 text-secondary">
              <DoorOpen className="h-8 w-8" />
            </span>
            <span className="text-xl font-extrabold text-foreground">Crear sala</span>
            <span className="text-sm text-muted-foreground">
              Elige juego y dificultad, invita a tus amigos con un código.
            </span>
          </Link>

          <Link
            href="/multijugador/unirse"
            className="group flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/10 p-8 text-center backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary hover:shadow-[0_8px_40px_-10px_rgba(74,222,154,0.55)]"
          >
            <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-primary">
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