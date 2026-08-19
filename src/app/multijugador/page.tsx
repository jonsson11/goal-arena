"use client";

// src/app/multijugador/page.tsx
//
// Pantalla de elección de modo (Fase 9, 19/08/2026) -- antes esta ruta
// era directamente "crear sala / unirse por código" (eso vive ahora en
// /multijugador/amigos, ver ese archivo). Diseño aprobado en el mockup
// del 19/08/2026: dos tarjetas grandes, sin etiqueta "Casual" en la de
// amigos (solo "Ranked" en la competitiva, que es la que aporta
// información), icono de cada modo como marca de agua tenue al fondo de
// la tarjeta en vez de icono protagonista en primer plano.

import Link from "next/link";
import { Trophy, Users } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { TituloPagina } from "@/components/layout/TituloPagina";
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
          <Link
            href="/multijugador/ranked"
            className="group relative flex min-h-[136px] flex-col justify-center gap-2 overflow-hidden rounded-2xl border border-primary/25 bg-card p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-primary/60 hover:shadow-[0_8px_40px_-10px_rgba(74,222,154,0.55)]"
            style={{
              backgroundImage:
                "radial-gradient(120% 140% at 15% 0%, rgba(74,222,154,0.16), transparent 60%)",
            }}
          >
            <Trophy
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-4 h-36 w-36 text-primary opacity-[0.09]"
            />
            <span className="relative z-[1] self-start rounded-full border border-primary/40 bg-primary/15 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-primary">
              Ranked
            </span>
            <h3 className="relative z-[1] text-lg font-extrabold text-foreground">Modo Competitivo</h3>
            <p className="relative z-[1] max-w-[82%] text-sm leading-relaxed text-muted-foreground">
              1vs1 de Grid contra un rival de tu nivel. Gana trofeos, sube de liga, desbloquea cosméticos de
              temporada.
            </p>
            <div className="relative z-[1] mt-1 flex items-center gap-1.5 border-t border-border pt-2.5 text-xs text-muted-foreground">
              <span>Tu liga actual:</span>
              <b className="font-bold" style={{ color: liga.color }}>
                {liga.nombre}
              </b>
              <span>· {usuario.trofeos.toLocaleString("es-ES")} 🏆</span>
            </div>
          </Link>

          <Link
            href="/multijugador/amigos"
            className="group relative flex min-h-[136px] flex-col justify-center gap-2 overflow-hidden rounded-2xl border border-secondary/25 bg-card p-6 backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-secondary/60 hover:shadow-[0_8px_40px_-10px_rgba(29,122,156,0.55)]"
            style={{
              backgroundImage:
                "radial-gradient(120% 140% at 15% 0%, rgba(29,122,156,0.18), transparent 60%)",
            }}
          >
            <Users
              aria-hidden
              className="pointer-events-none absolute -bottom-6 -right-4 h-36 w-36 text-secondary opacity-[0.09]"
            />
            <h3 className="relative z-[1] text-lg font-extrabold text-foreground">Jugar con Amigos</h3>
            <p className="relative z-[1] max-w-[82%] text-sm leading-relaxed text-muted-foreground">
              Crea una sala o únete con un código. Grid, Top10 o LinkPlayers, de 2 a 8 jugadores, sin presión
              de trofeos.
            </p>
          </Link>
        </div>
      </div>
    </div>
  );
}
