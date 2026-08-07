// src/features/profile/LogroDetailDialog.tsx
//
// Se abre al tocar cualquier insignia (bloqueada, reclamable o ya
// reclamada) -- muestra nombre, descripción y el estado real:
// - Bloqueado: barra de progreso "x/umbral".
// - Reclamable: botón "Reclamar recompensa (+N EXP)".
// - Reclamado: fecha de cuándo, más la EXP que dio en su momento.
//
// Al reclamar con éxito, la respuesta del servidor (RespuestaPartida) se
// pasa tal cual a <ExperienciaGanada>, el mismo componente que anima la
// barra de nivel al ganar una partida -- así reclamar un logro se siente
// exactamente igual de bien, sin inventar una animación nueva.

"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { ExperienciaGanada } from "@/features/games/shared/ExperienciaGanada";
import { LogroInsignia } from "./LogroInsignia";
import { EXP_POR_TIER, type LogroConProgreso } from "@/lib/logros";
import type { RespuestaPartida } from "@/lib/experiencia";

type Props = {
  logro: LogroConProgreso | null;
  onOpenChange: (open: boolean) => void;
  onReclamado: (logroId: string, respuesta: RespuestaPartida) => void;
};

function formatearFecha(iso: string): string {
  return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });
}

export function LogroDetailDialog({ logro, onOpenChange, onReclamado }: Props) {
  const [reclamando, setReclamando] = useState(false);
  const [error, setError] = useState("");
  const [respuesta, setRespuesta] = useState<RespuestaPartida | null>(null);

  function alCambiarApertura(open: boolean) {
    if (!open) {
      setError("");
      setRespuesta(null);
    }
    onOpenChange(open);
  }

  if (!logro) return null;

  async function reclamar() {
    if (!logro) return;
    setReclamando(true);
    setError("");
    try {
      const res = await fetch(`/api/perfil/logros/${logro.id}/reclamar`, { method: "POST" });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo reclamar el logro.");
        return;
      }
      setRespuesta(datos as RespuestaPartida);
      onReclamado(logro.id, datos as RespuestaPartida);
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setReclamando(false);
    }
  }

  const expDelTier = EXP_POR_TIER[logro.tier];

  return (
    <Dialog open={logro !== null} onOpenChange={alCambiarApertura}>
      <DialogContent>
        <DialogHeader>
          <div className="mb-1 flex justify-center">
            <LogroInsignia logro={logro} tamano="lg" />
          </div>
          <DialogTitle className="text-center">{logro.nombre}</DialogTitle>
          <DialogDescription className="text-center">{logro.descripcion}</DialogDescription>
        </DialogHeader>

        {respuesta ? (
          <ExperienciaGanada respuesta={respuesta} />
        ) : logro.estado === "bloqueado" ? (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1">
                <Lock className="h-3 w-3" /> Progreso
              </span>
              <span>
                {logro.progreso} / {logro.umbral}
              </span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-muted-foreground/50 transition-all duration-500"
                style={{ width: `${Math.min(100, (logro.progreso / logro.umbral) * 100)}%` }}
              />
            </div>
          </div>
        ) : logro.estado === "reclamable" ? (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm font-bold text-primary">Recompensa: +{expDelTier} EXP</p>
            {error && <p className="text-xs font-semibold text-destructive">{error}</p>}
            <GameButton onClick={reclamar} disabled={reclamando} className="w-full py-3">
              {reclamando ? "Reclamando..." : `Reclamar recompensa (+${expDelTier} EXP)`}
            </GameButton>
          </div>
        ) : (
          <p className="text-center text-xs text-muted-foreground">
            Reclamado el {formatearFecha(logro.reclamadoEn!)} · +{logro.expGanada} EXP
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}