// src/components/home/StatsSection.tsx
//
// Dos bloques con criterios distintos, a propósito:
//
// 1. La fila de arriba: "Minijuegos" (6) y "Jugadores por sala" (8) son
//    hechos del propio producto (estáticos, no pueden ser falsos).
//    "Partidas jugadas" y "Jugadores activos" SÍ eran números
//    inventados a mano ("1.200+", "350+") y ahora se piden de verdad.
//
// 2. "Base de datos propia" (07/08/2026): futbolistas, equipos y
//    rankings de Top10 cargados -- a diferencia de la fila de arriba,
//    estas cifras no dependen de cuánta gente esté jugando todavía (hoy,
//    poca), son el contenido de fútbol que ya tenéis reunido, y ese sí
//    es un número real y grande del que presumir sin exagerar nada. La
//    etiqueta "Base de datos propia" dice explícitamente de qué tipo de
//    cifra se trata, para que no se confunda con "gente usando la app".

"use client";

import { useEffect, useState } from "react";

type EstadisticasGlobales = {
  totalPartidas: number;
  totalJugadoresActivos: number;
  totalFutbolistas: number;
  totalEquipos: number;
  totalRankingsTop10: number;
};

const FORMATO_ES = new Intl.NumberFormat("es-ES");

function fmt(valor: number | undefined): string {
  return valor === undefined ? "…" : FORMATO_ES.format(valor);
}

export function StatsSection() {
  const [datos, setDatos] = useState<EstadisticasGlobales | null>(null);

  useEffect(() => {
    fetch("/api/estadisticas/globales")
      .then((res) => res.json())
      .then((json) => setDatos(json as EstadisticasGlobales))
      .catch(() =>
        setDatos({
          totalPartidas: 0,
          totalJugadoresActivos: 0,
          totalFutbolistas: 0,
          totalEquipos: 0,
          totalRankingsTop10: 0,
        })
      );
  }, []);

  const statsUso = [
    { valor: "6", etiqueta: "Minijuegos" },
    { valor: fmt(datos?.totalPartidas), etiqueta: "Partidas jugadas" },
    { valor: fmt(datos?.totalJugadoresActivos), etiqueta: "Jugadores activos" },
    { valor: "8", etiqueta: "Jugadores por sala" },
  ];

  const statsContenido = [
    { valor: fmt(datos?.totalFutbolistas), etiqueta: "Futbolistas" },
    { valor: fmt(datos?.totalEquipos), etiqueta: "Equipos" },
    { valor: fmt(datos?.totalRankingsTop10), etiqueta: "Rankings de Top10" },
  ];

  return (
    <section className="border-y border-border bg-card/50 px-6 py-14">
      <div className="mx-auto flex max-w-4xl flex-col gap-10">
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-4">
          {statsUso.map((stat) => (
            <div key={stat.etiqueta} className="flex flex-col items-center gap-1">
              <span className="text-3xl font-extrabold text-primary sm:text-4xl">
                {stat.valor}
              </span>
              <span className="text-center text-xs text-muted-foreground sm:text-sm">
                {stat.etiqueta}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col items-center gap-4">
          <span className="rounded-full bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
            Base de datos propia
          </span>
          <div className="grid grid-cols-3 gap-8">
            {statsContenido.map((stat) => (
              <div key={stat.etiqueta} className="flex flex-col items-center gap-1">
                <span className="text-3xl font-extrabold text-secondary sm:text-4xl">
                  {stat.valor}
                </span>
                <span className="text-center text-xs text-muted-foreground sm:text-sm">
                  {stat.etiqueta}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}