"use client";

import { useState } from "react";
import { GameButton } from "@/features/games/shared/GameButton";
import { EditProfileDialog } from "./EditProfileDialog";
import {
  usuarioInicial,
  estadisticasRapidas,
  historialPartidas,
  logros,
} from "./data";
import type { Usuario } from "./type";

export function ProfileView() {
  const [usuario, setUsuario] = useState<Usuario>(usuarioInicial);
  const [editando, setEditando] = useState(false);

  function guardarPerfil(nombre: string, avatar: string) {
    setUsuario({ ...usuario, nombre, avatar });
  }

  const porcentajeXp = Math.round((usuario.xpActual / usuario.xpSiguienteNivel) * 100);

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
      {/* Cabecera */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-[0_0_30px_-8px_rgba(74,222,154,0.4)]">
        <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-5xl">
          {usuario.avatar}
        </div>

        <h1 className="text-2xl font-extrabold text-foreground">{usuario.nombre}</h1>

        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground">
            <span>Nivel {usuario.nivel}</span>
            <span>
              {usuario.xpActual} / {usuario.xpSiguienteNivel} XP
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${porcentajeXp}%` }}
            />
          </div>
        </div>

        <GameButton variant="secondary" onClick={() => setEditando(true)} className="mt-2">
          Editar perfil
        </GameButton>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { valor: estadisticasRapidas.partidasJugadas, etiqueta: "Partidas" },
          { valor: `${estadisticasRapidas.porcentajeAcierto}%`, etiqueta: "Acierto" },
          { valor: estadisticasRapidas.rachaActual, etiqueta: "Racha actual" },
          { valor: estadisticasRapidas.rachaMaxima, etiqueta: "Racha máxima" },
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

      {/* Historial de partidas */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Partidas recientes</h2>

        <div className="flex flex-col gap-2">
          {historialPartidas.map((partida) => (
            <div
              key={partida.id}
              className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
            >
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-foreground">{partida.juego}</span>
                <span className="text-xs text-muted-foreground">{partida.detalle}</span>
              </div>

              <div className="flex flex-col items-end gap-1">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                    partida.resultado === "victoria"
                      ? "bg-primary/15 text-primary"
                      : "bg-destructive/15 text-destructive"
                  }`}
                >
                  {partida.resultado === "victoria" ? "Victoria" : "Derrota"}
                </span>
                <span className="text-xs text-muted-foreground">{partida.fecha}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Logros */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Logros</h2>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {logros.map((logro) => (
            <div
              key={logro.id}
              title={logro.desbloqueado ? logro.descripcion : "Bloqueado"}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all ${
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

      <EditProfileDialog
        open={editando}
        onOpenChange={setEditando}
        usuario={usuario}
        onGuardar={guardarPerfil}
      />
    </div>
  );
}