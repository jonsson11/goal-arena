"use client";

// src/app/multijugador/page.tsx
//
// Pantalla de elección de modo (Fase 9, 19/08/2026) -- antes esta ruta
// era directamente "crear sala / unirse por código" (eso vive ahora en
// /multijugador/amigos, ver ese archivo).
//
// Rediseño "lomo de color" (Fase 10, 19/08/2026): sustituye el diseño de
// icono como marca de agua tenue al fondo de la tarjeta (Fase 9) por
// TarjetaLomo.tsx -- franja de color sólida con el icono dentro --, tras
// una ronda de feedback en la que ese diseño de marca de agua no acababa
// de convencer y se probaron varias alternativas con mockups (ver
// claude/diseno-modo-competitivo.md).

import { Trophy, Users } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { TituloPagina } from "@/components/layout/TituloPagina";
import { TarjetaLomo } from "@/features/games/shared/TarjetaLomo";
import { ligaPorTrofeos } from "@/lib/trofeos";

export default function MultijugadorPage() {
  const { usuario } = useAuth();

  if (!usuario) {
    return (
      <AuthGate
        icono="🎮"
        titulo="Juega en multijugador"
        descripcion="Crea una cuenta o inicia sesión para competir por trofeos o jugar tranquilo con tus amigos."
        redirectTras="/multijugador"
        aspectos={["🏆 Ladder competitivo", "🎮 Salas con amigos", "⏱️ Mismo reto, en directo"]}
      />
    );
  }

  const liga = ligaPorTrofeos(usuario.trofeos);

  return (
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      <TituloPagina acento="azul" hrefAtras="/" className="mb-2">
        Multijugador
      </TituloPagina>

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col items-center gap-2">
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Compite por trofeos o juega tranquilo con amigos — tú eliges.
        </p>

        <div className="flex w-full flex-col gap-5">
          <TarjetaLomo
            href="/multijugador/ranked"
            acento="primary"
            icono={<Trophy className="h-7 w-7" />}
            titulo="Modo Competitivo"
            descripcion="1vs1 de Grid contra un rival de tu nivel. Gana trofeos, sube de liga, desbloquea cosméticos de temporada."
            badge={
              <span className="rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary">
                Ranked
              </span>
            }
            footer={
              <div className="mt-1 flex flex-wrap items-center gap-1.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
                <span>Tu liga actual:</span>
                <b className="font-bold" style={{ color: liga.color }}>
                  {liga.nombre}
                </b>
                <span>· {usuario.trofeos.toLocaleString("es-ES")} 🏆</span>
              </div>
            }
          />

          <TarjetaLomo
            href="/multijugador/amigos"
            acento="secondary"
            icono={<Users className="h-7 w-7" />}
            titulo="Jugar con Amigos"
            descripcion="Crea una sala o únete con un código. Grid, Top10 o LinkPlayers, de 2 a 8 jugadores, sin presión de trofeos."
          />
        </div>
      </div>
    </div>
  );
}
