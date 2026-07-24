"use client";

import { useEffect, useRef, useState } from "react";
import type { Jugador } from "@/features/games/shared/types";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { ETIQUETAS_CATEGORIA, type Categoria } from "./type";
import {
  elegirCategoriaAleatoria,
  elegirJugadorAleatorio,
  comprobarRespuesta,
} from "./logic";
import { CategoriaSlider } from "./CategoriaSlider";

type Fase = "girando" | "jugando";
type EstadoRonda = "esperando" | "revelando" | "moviendo" | "entrando";

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
  const [perdida, setPerdida] = useState(false);
  const [popupAbierto, setPopupAbierto] = useState(false);

  const [estadoRonda, setEstadoRonda] = useState<EstadoRonda>("esperando");
  const [distanciaPx, setDistanciaPx] = useState(0);
  const [sinTransicion, setSinTransicion] = useState(false);

  const cartaIzquierdaRef = useRef<HTMLDivElement>(null);
  const cartaDerechaRef = useRef<HTMLDivElement>(null);

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
    if (!jugadorSiguiente || !partida || estadoRonda !== "esperando" || perdida) return;

    const acierto = comprobarRespuesta(
      partida.jugadorActual,
      jugadorSiguiente,
      partida.categoria,
      respuesta
    );

    if (!acierto) {
      setPerdida(true);
      setPopupAbierto(true);
      return;
    }

    setRacha(racha + 1);
    setEstadoRonda("revelando");

    setTimeout(() => {
      const izquierda = cartaIzquierdaRef.current?.getBoundingClientRect();
      const derecha = cartaDerechaRef.current?.getBoundingClientRect();

      if (izquierda && derecha) {
        setDistanciaPx(derecha.left - izquierda.left);
      }

      setEstadoRonda("moviendo");

      setTimeout(() => {
        setSinTransicion(true);
        setPartida({ ...partida, jugadorActual: jugadorSiguiente });
        empezarRonda(jugadorSiguiente);
        setEstadoRonda("entrando");

        setTimeout(() => {
          setSinTransicion(false);
          setEstadoRonda("esperando");
        }, 20);
      }, 300);
    }, 700);
  }

  function jugarDeNuevo() {
    setPartida(generarEstadoInicial());
    setJugadorSiguiente(null);
    setRacha(0);
    setPerdida(false);
    setPopupAbierto(false);
    setEstadoRonda("esperando");
    setDistanciaPx(0);
    setSinTransicion(false);
    setFase("girando");
  }

  if (!partida) {
    return <p className="p-6 text-center text-muted-foreground">Preparando partida...</p>;
  }

  const { categoria, jugadorActual } = partida;
  const revelando = estadoRonda === "revelando" || estadoRonda === "moviendo";
  const moviendo = estadoRonda === "moviendo";
  const entrando = estadoRonda === "entrando";
  const botonesDeshabilitados = estadoRonda !== "esperando" || perdida;

  return (
    <div className="flex flex-col items-center gap-8 p-6">
      {fase === "jugando" && (
        <p className="text-sm text-muted-foreground">
          Categoría: <span className="font-semibold text-foreground">{ETIQUETAS_CATEGORIA[categoria]}</span>
        </p>
      )}

      {fase === "girando" && (
        <CategoriaSlider categoriaGanadora={categoria} onTerminar={handleSliderTerminado} />
      )}

      {fase === "jugando" && jugadorSiguiente && (
        <>
          <div className="flex items-center gap-6">
            <div
              ref={cartaIzquierdaRef}
              className={`flex h-40 w-32 flex-col items-center justify-center gap-2 rounded-lg border border-border bg-card p-4 transition-opacity duration-200 ${
                moviendo ? "opacity-0" : "opacity-100"
              }`}
            >
              <span className="text-center text-sm font-semibold text-foreground">
                {jugadorActual.nombre}
              </span>
              <span className="text-2xl font-extrabold text-primary">
                {jugadorActual[categoria]}
              </span>
            </div>

            <span className="text-3xl font-bold text-muted-foreground">VS</span>

            <div
              ref={cartaDerechaRef}
              style={{
                transform: moviendo ? `translateX(-${distanciaPx}px)` : "translateX(0)",
                transition: sinTransicion ? "none" : "transform 300ms ease-in-out",
              }}
              className={`flex h-40 w-32 flex-col items-center justify-center gap-2 rounded-lg border bg-card p-4 ${
                revelando
                  ? "border-primary shadow-[0_0_20px_2px_rgba(74,222,154,0.4)]"
                  : "border-primary/50"
              } ${entrando ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"} ${
                !sinTransicion ? "transition-all duration-200" : ""
              }`}
            >
              <span className="text-center text-sm font-semibold text-foreground">
                {jugadorSiguiente.nombre}
              </span>
              <span
                className={`text-2xl font-extrabold transition-colors duration-200 ${
                  revelando ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {revelando ? jugadorSiguiente[categoria] : "?"}
              </span>
            </div>
          </div>

          <div className="flex gap-4">
            <GameButton
              onClick={() => handleRespuesta("mayor")}
              disabled={botonesDeshabilitados}
            >
              Mayor ▲
            </GameButton>
            <GameButton
              variant="secondary"
              onClick={() => handleRespuesta("menor")}
              disabled={botonesDeshabilitados}
            >
              Menor ▼
            </GameButton>
          </div>

          <p className="text-lg font-bold text-foreground">Racha: {racha}</p>
        </>
      )}

      {perdida && (
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
      )}
    </div>
  );
}