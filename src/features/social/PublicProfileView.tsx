"use client";

import Link from "next/link";
import { generarEstadisticasPublicas, generarLogrosPublicos } from "./mockPublicProfile";
import type { Amigo } from "./type";

type PublicProfileViewProps = {
  amigo: Amigo;
};

export function PublicProfileView({ amigo }: PublicProfileViewProps) {
  const stats = generarEstadisticasPublicas(amigo);
  const logros = generarLogrosPublicos(amigo);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
      <Link
        href="/social"
        className="self-start text-sm font-semibold text-muted-foreground transition-colors hover:text-primary"
      >
        ‹ Volver a Social
      </Link>

      {/* Cabecera */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-[0_0_30px_-8px_rgba(74,222,154,0.4)]">
        <div className="relative">
          <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-5xl">
            {amigo.avatar}
          </div>
          <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-xs font-extrabold text-primary-foreground shadow-[0_0_10px_-1px_rgba(74,222,154,0.8)]">
            {amigo.nivel}
          </div>
          <span
            className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-card ${
              amigo.enLinea ? "bg-primary" : "bg-muted-foreground"
            }`}
          />
        </div>

        <h1 className="text-2xl font-extrabold text-foreground">{amigo.nombre}</h1>
        <span
          className={`text-xs font-semibold ${
            amigo.enLinea ? "text-primary" : "text-muted-foreground"
          }`}
        >
          {amigo.enLinea ? "Conectado" : "Desconectado"}
        </span>
      </div>

      {/* Resumen */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { valor: stats.partidasJugadas, etiqueta: "Partidas" },
          { valor: `${stats.porcentajeAcierto}%`, etiqueta: "Acierto" },
          { valor: stats.rachaMaxima, etiqueta: "Racha máxima" },
        ].map((stat) => (
          <div
            key={stat.etiqueta}
            className="flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-4"
          >
            <span className="text-2xl font-extrabold text-primary">{stat.valor}</span>
            <span className="text-center text-xs text-muted-foreground">{stat.etiqueta}</span>
          </div>
        ))}
      </div>

      {/* Logros */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Logros</h2>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {logros.map((logro) => (
            <div
              key={logro.id}
              title={logro.desbloqueado ? logro.descripcion : "Bloqueado"}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all duration-200 ${
                logro.desbloqueado
                  ? "border-primary/40 bg-primary/10 shadow-[0_0_16px_-4px_rgba(74,222,154,0.5)]"
                  : "border-border bg-card opacity-40 grayscale"
              }`}
            >
              <span className="text-3xl">{logro.icono}</span>
              <span className="text-xs font-semibold text-foreground">{logro.nombre}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}