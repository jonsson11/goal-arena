"use client";

import { BotonAtras } from "@/features/games/shared/BotonAtras";
import type { Amigo, EstadisticasPublicas } from "./type";

type PublicProfileViewProps = {
  amigo: Amigo;
  estadisticas: EstadisticasPublicas;
};

export function PublicProfileView({ amigo, estadisticas }: PublicProfileViewProps) {
  return (
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      {/* Botón circular en móvil / píldora "< Atrás" en escritorio, fuera
          de la columna centrada de abajo -- mismo patrón que el resto de
          la app (ver BotonAtras.tsx y TituloPagina.tsx). Aquí no se usa
          TituloPagina porque esta pantalla no tiene un título de página
          grande con degradado, así que el botón va suelto. */}
      <BotonAtras href="/social" className="mb-4" />

      <div className="mx-auto flex max-w-2xl flex-col gap-8">
        {/* Cabecera */}
        <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-[0_0_30px_-8px_rgba(74,222,154,0.4)]">
          <div className="relative">
            {amigo.avatarTipo === "foto" ? (
              // eslint-disable-next-line @next/next/no-img-element -- foto de perfil de otro usuario (URL de Supabase Storage)
              <img
                src={amigo.avatar}
                alt={amigo.nombre}
                className="h-24 w-24 rounded-full border-2 border-primary object-cover"
              />
            ) : (
              <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-5xl">
                {amigo.avatar}
              </div>
            )}
            <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-xs font-extrabold text-primary-foreground shadow-[0_0_10px_-1px_rgba(74,222,154,0.8)]">
              {amigo.nivel}
            </div>
            <span
              className={`absolute -top-1 -right-1 h-4 w-4 rounded-full border-2 border-card ${
                amigo.enLinea ? "bg-primary" : "bg-destructive"
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

        {/* Resumen -- datos reales de PartidaJugada, ver /api/usuarios/[nombre] */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { valor: estadisticas.partidasJugadas, etiqueta: "Partidas" },
            { valor: `${estadisticas.porcentajeAcierto}%`, etiqueta: "Victorias" },
            { valor: estadisticas.rachaMaxima, etiqueta: "Racha máxima" },
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

        {/* Logros: quitados de aquí a propósito el 07/08/2026 -- se
            calculaban con una fórmula falsa a partir del nivel
            (mockPublicProfile.ts, ya borrado), ni una sola cifra real.
            Se reconectan en cuanto exista el sistema real de logros
            (Achievement/UserAchievement), mostrando los que el amigo
            tenga desbloqueados de verdad -- sin botón de reclamar aquí,
            eso es una acción privada de cada uno sobre sus propios
            logros. */}
      </div>
    </div>
  );
}