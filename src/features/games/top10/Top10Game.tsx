"use client";

import { useState } from "react";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import type { EntradaTop10, RankingTop10 } from "./type";
import { rankings } from "./data";
import { buscarEntradaCoincidente } from "./logic";

const RANKING_ACTUAL: RankingTop10 = rankings[0];

function segundosTranscurridos(inicio: number): number {
  return Math.floor((Date.now() - inicio) / 1000);
}

type EstiloPosicion = {
  fila: string;
  badge: string;
  nombre: string;
};

function obtenerEstiloPosicion(posicion: number, acertado: boolean): EstiloPosicion {
  if (!acertado) {
    return {
      fila: "border-border bg-card",
      badge: "bg-muted text-muted-foreground",
      nombre: "text-muted-foreground",
    };
  }

  if (posicion === 1) {
    return {
      fila: "border-[var(--gold)] bg-[var(--gold)]/10 shadow-[0_0_18px_-2px_var(--gold)]",
      badge: "bg-[var(--gold)] text-[#1a1200]",
      nombre: "text-[var(--gold)]",
    };
  }

  if (posicion === 2) {
    return {
      fila: "border-[var(--silver)] bg-[var(--silver)]/10 shadow-[0_0_18px_-2px_var(--silver)]",
      badge: "bg-[var(--silver)] text-[#1a1c20]",
      nombre: "text-[var(--silver)]",
    };
  }

  if (posicion === 3) {
    return {
      fila: "border-[var(--bronze)] bg-[var(--bronze)]/10 shadow-[0_0_18px_-2px_var(--bronze)]",
      badge: "bg-[var(--bronze)] text-[#1a0f00]",
      nombre: "text-[var(--bronze)]",
    };
  }

  return {
    fila: "border-primary/50 bg-primary/10",
    badge: "bg-primary text-primary-foreground",
    nombre: "text-primary",
  };
}

export function Top10Game() {
  const [acertados, setAcertados] = useState<EntradaTop10[]>([]);
  const [textoEscrito, setTextoEscrito] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [horaInicio, setHoraInicio] = useState(() => Date.now());
  const [tiempoFinal, setTiempoFinal] = useState<number | null>(null);
  const [rendido, setRendido] = useState(false);
  const [popupAbierto, setPopupAbierto] = useState(false);

  const completado = acertados.length === RANKING_ACTUAL.respuestas.length;

  function estaAcertado(entrada: EntradaTop10): boolean {
    return acertados.some((a) => a.nombre === entrada.nombre);
  }

  function handleComprobar() {
    if (!textoEscrito.trim()) return;

    const encontrada = buscarEntradaCoincidente(RANKING_ACTUAL.respuestas, textoEscrito);

    if (!encontrada) {
      setMensaje("Ese nombre no está en el Top 10.");
      setTextoEscrito("");
      return;
    }

    if (estaAcertado(encontrada)) {
      setMensaje(`${encontrada.nombre} ya ha sido colocado.`);
      setTextoEscrito("");
      return;
    }

    const nuevosAcertados = [...acertados, encontrada];
    setAcertados(nuevosAcertados);
    setMensaje(`¡${encontrada.nombre} correcto!`);
    setTextoEscrito("");

    if (nuevosAcertados.length === RANKING_ACTUAL.respuestas.length) {
      setTiempoFinal(segundosTranscurridos(horaInicio));
      setPopupAbierto(true);
    }
  }

  function handleRendirse() {
    setTiempoFinal(segundosTranscurridos(horaInicio));
    setRendido(true);
    setPopupAbierto(true);
  }

  function jugarDeNuevo() {
    setAcertados([]);
    setTextoEscrito("");
    setMensaje("");
    setHoraInicio(Date.now());
    setTiempoFinal(null);
    setRendido(false);
    setPopupAbierto(false);
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <h1 className="text-center text-2xl font-bold text-foreground">
        {RANKING_ACTUAL.titulo}
      </h1>

      <div className="grid w-full max-w-md grid-flow-col grid-cols-2 grid-rows-5 gap-2 sm:flex sm:max-w-2xl sm:flex-col">
        {RANKING_ACTUAL.respuestas.map((entrada, i) => {
          const posicion = i + 1;
          const acertado = estaAcertado(entrada);
          const codigoPais = obtenerCodigoPais(entrada.nacionalidad);
          const estilo = obtenerEstiloPosicion(posicion, acertado);

          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-md border px-3 py-2 transition-all duration-300 sm:px-4 sm:py-3 ${estilo.fila}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 sm:text-sm ${estilo.badge}`}
              >
                {posicion}
              </span>
              <span
                className={`flex-1 text-center text-sm font-semibold sm:text-base ${estilo.nombre}`}
              >
                {acertado ? entrada.nombre : "???"}
              </span>
              <span className="flex items-center justify-end">
                {codigoPais && (
                  <span
                    className={`fi fi-${codigoPais} h-3.75 w-5 rounded-sm sm:h-6 sm:w-9`}
                  />
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          value={textoEscrito}
          onChange={(e) => setTextoEscrito(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleComprobar();
          }}
          placeholder="Escribe un jugador..."
          className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
        />
        <GameButton onClick={handleComprobar}>Comprobar</GameButton>
        <GameButton variant="destructive" onClick={handleRendirse}>
          Rendirse
        </GameButton>
      </div>

      <p className="text-sm text-muted-foreground">
        {acertados.length}/{RANKING_ACTUAL.respuestas.length} acertados
      </p>

      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}

      {(completado || rendido) && (
        <GameResultDialog
          open={popupAbierto}
          onOpenChange={setPopupAbierto}
          resultado={completado ? "exito" : "fracaso"}
          titulo={completado ? "TOP 10 COMPLETADO" : "TOP 10 NO COMPLETADO"}
          descripcion={
            completado ? (
              <>
                Has acertado los 10 en{" "}
                <span className="font-semibold text-foreground">{tiempoFinal}</span> segundos.
              </>
            ) : (
              <>
                Te has rendido con{" "}
                <span className="font-semibold text-foreground">{acertados.length}/10</span>{" "}
                acertados.
              </>
            )
          }
          onJugarDeNuevo={jugarDeNuevo}
        />
      )}
    </div>
  );
}