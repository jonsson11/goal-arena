"use client";

// src/app/multijugador/amigos/page.tsx
//
// "Jugar con Amigos" -- lo que antes vivía directamente en
// /multijugador (crear sala / unirse por código). Se movió aquí el
// 19/08/2026 al convertir /multijugador en la pantalla de elección de
// modo (Competitivo vs Amigos, ver ese archivo) -- contenido idéntico al
// de antes, solo cambia la ruta y el `hrefAtras` (ahora vuelve a la
// elección de modo, no a Inicio).
//
// Rediseño "lomo de color" (Fase 10, 19/08/2026): las dos tarjetas
// (Crear sala / Unirse a sala) pasan de icono centrado sobre cristal
// tintado a TarjetaLomo.tsx, mismo lenguaje que /multijugador y las
// tarjetas de /jugar -- consistencia pedida explícitamente por el
// usuario ("quiero seguir la misma línea de diseño en todo el
// proyecto").

import { DoorOpen, KeyRound } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { TituloPagina } from "@/components/layout/TituloPagina";
import { TarjetaLomo } from "@/features/games/shared/TarjetaLomo";

export default function JugarConAmigosPage() {
  const { usuario } = useAuth();

  if (!usuario) {
    return (
      <AuthGate
        icono="🎮"
        titulo="Juega con tus amigos"
        descripcion="Crea una cuenta o inicia sesión para crear una sala multijugador o unirte a la de un amigo."
        redirectTras="/multijugador/amigos"
        aspectos={["🎮 Salas de 2 a 8", "⏱️ Mismo reto, en directo", "🏆 Historial contra amigos"]}
      />
    );
  }

  return (
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      <TituloPagina acento="azul" hrefAtras="/multijugador" className="mb-2">
        Jugar con Amigos
      </TituloPagina>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-2">
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Enfréntate en directo a tus amigos, el mismo reto para todos.
        </p>

        <div className="grid w-full grid-cols-1 gap-6 sm:grid-cols-2">
          <TarjetaLomo
            href="/multijugador/crear"
            acento="secondary"
            icono={<DoorOpen className="h-7 w-7" />}
            titulo="Crear sala"
            descripcion="Elige juego y dificultad, invita a tus amigos con un código."
            compacta
          />

          <TarjetaLomo
            href="/multijugador/unirse"
            acento="primary"
            icono={<KeyRound className="h-7 w-7" />}
            titulo="Unirse a sala"
            descripcion="Introduce el código que te ha pasado un amigo."
            compacta
          />
        </div>
      </div>
    </div>
  );
}
