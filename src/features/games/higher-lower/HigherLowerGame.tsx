"use client";

import { useEffect, useState } from "react";
import type { Jugador } from "@/features/games/shared/types";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { ETIQUETAS_CATEGORIA, type Categoria } from "./type";
import {
  elegirCategoriaAleatoria,
  elegirJugadorAleatorio,
  comprobarRespuesta,
} from "./logic";
import { CategoriaSlider } from "./CategoriaSlider";

type Fase = "girando" | "jugando";

type EstadoPartida = {
  categoria: Categoria;
  jugadorActual: Jugador;
};

function generarEstadoInicial(): EstadoPartida {
  return {
    categoria: elegirCategoriaAleatoria(),
    jugadorActual: elegirJugadorAleatorio(),
  };
}

export function HigherLowerGame() {
  const [partida, setPartida] = useState<EstadoPartida | null>(null);
  const [fase, setFase] = useState<Fase>("girando");
  const [jugadorSiguiente, setJugadorSiguiente] = useState<Jugador | null>(null);
  const [racha, setRacha] = useState(0);
  const [popupAbierto, setPopupAbierto] = useState(false);

  useEffect(() => {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- inicialización aleatoria one-time, solo válida en cliente (evita mismatch de hidratación)
    setPartida(generarEstadoInicial());
  }, []);

  function empezarRonda(actual: Jugador) {
    setJugadorSiguiente(elegirJugadorAleatorio(actual));
  }

  function handleSliderTerminado() {
    setFase("jugando");
    if (partida) empezarRonda(partida.jugadorActual);
  }

  function handleRespuesta(respuesta: "mayor" | "menor") {
    if (!jugadorSiguiente || !partida) return;

    const acierto = comprobarRespuesta(
      partida.jugadorActual,
      jugadorSiguiente,
      partida.categoria,
      respuesta
    );

    if (acierto) {
      setRacha(racha + 1);
      setPartida({ ...partida, jugadorActual: jugadorSiguiente });
      empezarRonda(jugadorSiguiente);
    } else {
      setPopupAbierto(true);
    }
  }

  function jugarDeNuevo() {
    setPartida(generarEstadoInicial());
    setJugadorSiguiente(null);
    setRacha(0);
    setPopupAbierto(false);
    setFase("girando");
  }

  if (!partida) {
    return <p className="p-6 text-center text-muted-foreground">Preparando partida...</p>;
  }

  const { categoria, jugadorActual } = partida;

  return (
    <div className="flex flex-col items-center gap-8 p-6">
      <p className="text-sm text-muted-foreground">
        Categoría: <span className="font-semibold text-foreground">{ETIQUETAS_CATEGORIA[categoria]}</span>
      </p>

      {fase === "girando" && (
        <CategoriaSlider categoriaGanadora={categoria} onTerminar={handleSliderTerminado} />
      )}

      {fase === "jugando" && jugadorSiguiente && (
        <>
          <div className="flex items-center gap-6">
            <div className="flex h-40 w-32 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-4">
              <span className="text-center text-sm font-semibold text-foreground">
                {jugadorActual.nombre}
              </span>
              <span className="text-2xl font-extrabold text-primary">
                {jugadorActual[categoria]}
              </span>
            </div>

            <span className="text-3xl font-bold text-muted-foreground">VS</span>

            <div className="flex h-40 w-32 flex-col items-center justify-center gap-2 rounded-lg border border-primary/50 bg-card p-4">
              <span className="text-center text-sm font-semibold text-foreground">
                {jugadorSiguiente.nombre}
              </span>
              <span className="text-2xl font-extrabold text-muted-foreground">?</span>
            </div>
          </div>

          <div className="flex gap-4">
            <button
              onClick={() => handleRespuesta("mayor")}
              className="rounded-md bg-primary px-6 py-3 font-semibold text-primary-foreground transition-opacity hover:opacity-90"
            >
              Mayor ▲
            </button>
            <button
              onClick={() => handleRespuesta("menor")}
              className="rounded-md bg-secondary px-6 py-3 font-semibold text-secondary-foreground transition-opacity hover:opacity-90"
            >
              Menor ▼
            </button>
          </div>

          <p className="text-lg font-bold text-foreground">Racha: {racha}</p>
        </>
      )}

      <GameResultDialog
        open={popupAbierto}
        onOpenChange={setPopupAbierto}
        resultado="fracaso"
        titulo="RACHA TERMINADA"
        descripcion={
          <>
            Has conseguido una racha de{" "}
            <span className="font-semibold text-foreground">{racha}</span> aciertos.
          </>
        }
        onJugarDeNuevo={jugarDeNuevo}
      />
    </div>
  );
}