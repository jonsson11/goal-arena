// src/features/games/shared/useRegistrarPartida.ts
"use client";

import { useCallback } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import type { RespuestaPartida } from "@/lib/experiencia";

/**
 * Hook compartido por GridBoard y Top10Game (y cualquier minijuego que se
 * añada después) para registrar el resultado de una partida terminada.
 *
 * Se traga cualquier error de red/servidor y devuelve `null` en vez de
 * lanzar -- registrar la partida no debe poder romper la pantalla de
 * resultado si falla (el jugador ya vio si ganó o perdió; en el peor caso
 * se queda sin la EXP de esa partida, no sin poder ver que ganó).
 */
export function useRegistrarPartida() {
  const { refrescarUsuario } = useAuth();

  return useCallback(
    async (
      juego: "GRID" | "TOP10",
      modo: string | null,
      resultado: "victoria" | "derrota",
      /** Segundos que tardó la partida -- solo importa en victoria (bonus
       * por rapidez, ver src/lib/experiencia.ts), pero se manda siempre
       * igual para no bifurcar la firma; en derrota el servidor ni lo mira. */
      segundos = 0
    ): Promise<RespuestaPartida | null> => {
      try {
        const res = await fetch("/api/partidas", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ juego, modo, resultado, segundos }),
        });
        if (!res.ok) return null;

        const datos: RespuestaPartida = await res.json();

        // No se espera (await) a propósito: el Header (nivel/XP en la
        // barra de arriba) se pone al día en segundo plano, sin retrasar
        // la animación de "ganaste EXP" que ya tiene todo lo que necesita
        // en `datos`.
        refrescarUsuario();

        return datos;
      } catch {
        return null;
      }
    },
    [refrescarUsuario]
  );
}
