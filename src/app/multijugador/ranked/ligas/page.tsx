"use client";

// src/app/multijugador/ranked/ligas/page.tsx
//
// El "camino de ligas" -- pantalla propia (enlazable también desde el
// perfil más adelante) con las 6 divisiones en un camino vertical
// desplazable, Leyenda arriba del todo y Canterano abajo, centrado al
// entrar en la posición actual del jugador (mismo patrón "Clash Royale"
// validado en el mockup del 19/08/2026).

import { useEffect, useMemo, useRef } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { TituloPagina } from "@/components/layout/TituloPagina";
import { EscudoLiga } from "@/features/ranked/EscudoLiga";
import { LIGAS, ligaPorTrofeos } from "@/lib/trofeos";

export default function CaminoLigasPage() {
  const { usuario } = useAuth();
  const contenedorRef = useRef<HTMLDivElement>(null);
  const actualRef = useRef<HTMLDivElement>(null);

  const ligaActual = usuario ? ligaPorTrofeos(usuario.trofeos) : null;
  // De Leyenda (arriba) a Canterano (abajo) -- LIGAS ya está ordenado al
  // revés (Canterano primero), así que solo hay que invertirlo.
  const ligasDeArribaAbajo = useMemo(() => [...LIGAS].reverse(), []);

  useEffect(() => {
    if (!contenedorRef.current || !actualRef.current) return;
    const cont = contenedorRef.current;
    const actual = actualRef.current;
    cont.scrollTop = Math.max(0, actual.offsetTop - cont.clientHeight / 2 + actual.clientHeight / 2);
  }, []);

  if (!usuario || !ligaActual) {
    return (
      <AuthGate
        icono="🏆"
        titulo="El camino de ligas"
        descripcion="Inicia sesión para ver tu progreso por las 6 divisiones del modo competitivo."
        redirectTras="/multijugador/ranked/ligas"
        aspectos={["🏆 6 divisiones", "🎖️ Cosméticos por liga", "📈 Progreso por temporada"]}
      />
    );
  }

  const idxActual = LIGAS.findIndex((l) => l.id === ligaActual.id);

  return (
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      <TituloPagina acento="verde" hrefAtras="/multijugador/ranked" className="mb-2">
        Camino de Ligas
      </TituloPagina>

      <p className="mx-auto mb-4 max-w-md text-center text-xs text-muted-foreground">
        ↑ Desliza hacia arriba para ver lo que te queda · los galones bajo cada escudo marcan el rango
      </p>

      <div
        ref={contenedorRef}
        className="scrollbar-fina relative z-10 mx-auto flex h-[65vh] max-w-md flex-col overflow-y-auto rounded-2xl border border-border bg-background/40 px-2"
      >
        <div className="relative flex flex-col py-10">
          {/* Línea vertical punteada que atraviesa todo el camino. */}
          <div
            aria-hidden
            className="absolute left-1/2 top-10 bottom-10 w-px -translate-x-1/2"
            style={{
              backgroundImage:
                "repeating-linear-gradient(180deg, var(--border) 0 6px, transparent 6px 12px)",
            }}
          />

          {ligasDeArribaAbajo.map((liga, i) => {
            const idxReal = LIGAS.findIndex((l) => l.id === liga.id);
            const esActual = idxReal === idxActual;
            const superada = idxReal < idxActual;
            const bloqueada = idxReal > idxActual;
            const lado = i % 2 === 0 ? "justify-end text-right" : "justify-start text-left";

            return (
              <div
                key={liga.id}
                ref={esActual ? actualRef : undefined}
                className={`relative z-[1] flex items-center gap-3.5 py-6 ${lado} ${
                  bloqueada ? "opacity-40 saturate-50" : ""
                } ${esActual ? "rounded-2xl" : ""}`}
                style={
                  esActual
                    ? { backgroundImage: "radial-gradient(60% 140% at 50% 50%, rgba(74,222,154,.10), transparent 70%)" }
                    : undefined
                }
              >
                {i % 2 !== 0 && (
                  <EscudoBloque liga={liga} esActual={esActual} superada={superada} trofeos={usuario.trofeos} />
                )}
                <div className="max-w-[58%]">
                  <p className="text-[15px] font-extrabold text-foreground">{liga.nombre}</p>
                  <p className="text-[11px] text-muted-foreground">
                    {liga.rangoMin.toLocaleString("es-ES")}
                    {liga.rangoMax !== null ? ` – ${liga.rangoMax.toLocaleString("es-ES")}` : "+"} 🏆
                  </p>
                  {esActual && (
                    <span className="mt-1 inline-block rounded-full bg-primary px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-primary-foreground">
                      Tú estás aquí · {usuario.trofeos.toLocaleString("es-ES")}
                    </span>
                  )}
                </div>
                {i % 2 === 0 && (
                  <EscudoBloque liga={liga} esActual={esActual} superada={superada} trofeos={usuario.trofeos} />
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function EscudoBloque({
  liga,
  esActual,
  superada,
}: {
  liga: (typeof LIGAS)[number];
  esActual: boolean;
  superada: boolean;
  trofeos: number;
}) {
  return (
    <div className="relative shrink-0">
      {superada && (
        <span className="absolute -top-1.5 left-1/2 z-[1] flex h-4 w-4 -translate-x-1/2 items-center justify-center rounded-full bg-primary text-[9px] font-black text-primary-foreground">
          ✓
        </span>
      )}
      <EscudoLiga liga={liga} tamano={esActual ? 88 : 66} />
    </div>
  );
}
