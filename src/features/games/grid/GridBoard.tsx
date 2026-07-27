// src/features/games/grid/GridBoard.tsx
"use client";

import { useState } from "react";
import type { Jugador } from "@/features/games/shared/types";
import { jugadores } from "@/features/games/shared/data";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import type { Tablero, Celda } from "./type";
import { generarTableroVacio } from "./data";
import { celdasValidasParaJugador } from "./logic";

function segundosTranscurridos(inicio: number): number {
  return Math.floor((Date.now() - inicio) / 1000);
}

export function GridBoard() {
  const [tablero, setTablero] = useState<Tablero>(() => generarTableroVacio());
  const [mensaje, setMensaje] = useState("");
  const [celdasPendientes, setCeldasPendientes] = useState<Celda[]>([]);
  const [jugadorPendiente, setJugadorPendiente] = useState<Jugador | null>(null);

  const [horaInicio, setHoraInicio] = useState(() => Date.now());
  const [tiempoFinal, setTiempoFinal] = useState<number | null>(null);
  const [resultado, setResultado] = useState<"completado" | "rendido" | null>(null);
  const [popupAbierto, setPopupAbierto] = useState(false);

  function obtenerCelda(fila: number, columna: number): Celda {
    return tablero.celdas.find(
      (c) => c.fila === fila && c.columna === columna
    )!;
  }

  function colocarJugador(jugador: Jugador, celdaElegida: Celda) {
    const nuevasCeldas = tablero.celdas.map((c) =>
      c.fila === celdaElegida.fila && c.columna === celdaElegida.columna
        ? { ...c, jugador }
        : c
    );

    setTablero({ ...tablero, celdas: nuevasCeldas });
    setCeldasPendientes([]);
    setJugadorPendiente(null);
    setMensaje(`${jugador.nombre} colocado correctamente.`);

    const todasLlenas = nuevasCeldas.every((c) => c.jugador !== null);
    if (todasLlenas) {
      setTiempoFinal(segundosTranscurridos(horaInicio));
      setResultado("completado");
      setPopupAbierto(true);
    }
  }

  // Antes: handleBuscar() leía `nombreBuscado` y buscaba al jugador en el
  // array mock con un `.find()` por nombre exacto. PlayerSearch ya nos da
  // el objeto Jugador directamente al seleccionarlo, así que esta función
  // arranca justo donde antes terminaba el `.find()`.
  function procesarSeleccion(jugador: Jugador) {
    const validas = celdasValidasParaJugador(jugador, tablero);

    if (validas.length === 0) {
      setMensaje(`${jugador.nombre} no vale para ninguna casilla libre.`);
    } else if (validas.length === 1) {
      colocarJugador(jugador, validas[0]);
    } else {
      setCeldasPendientes(validas);
      setJugadorPendiente(jugador);
      setMensaje(`${jugador.nombre} vale para varias casillas. Elige una.`);
    }
  }

  function handleRendirse() {
    setTiempoFinal(segundosTranscurridos(horaInicio));
    setResultado("rendido");
    setPopupAbierto(true);
  }

  function jugarDeNuevo() {
    setTablero(generarTableroVacio());
    setMensaje("");
    setCeldasPendientes([]);
    setJugadorPendiente(null);
    setHoraInicio(Date.now());
    setTiempoFinal(null);
    setResultado(null);
    setPopupAbierto(false);
  }

  const celdasRellenas = tablero.celdas.filter((c) => c.jugador !== null).length;

  // Nombres ya colocados en el tablero, para no dejar repetirlos.
  const nombresUsados = tablero.celdas
    .filter((c) => c.jugador !== null)
    .map((c) => c.jugador!.nombre);

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <div className="grid grid-cols-4 gap-2">
        <div />
        {tablero.condicionesColumna.map((cond, i) => (
          <div key={i} className="flex items-center justify-center p-2 text-center text-sm font-semibold text-foreground">
            {cond.valor}
          </div>
        ))}

        {tablero.condicionesFila.map((condFila, fila) => (
          <div key={fila} className="contents">
            <div className="flex items-center justify-center p-2 text-center text-sm font-semibold text-foreground">
              {condFila.valor}
            </div>

            {[0, 1, 2].map((columna) => {
              const celda = obtenerCelda(fila, columna);
              const esPendiente = celdasPendientes.some(
                (c) => c.fila === fila && c.columna === columna
              );

              return (
                <button
                  key={columna}
                  disabled={!esPendiente && celdasPendientes.length > 0}
                  onClick={() => {
                    if (esPendiente && jugadorPendiente) {
                      colocarJugador(jugadorPendiente, celda);
                    }
                  }}
                  className={`flex h-24 w-24 items-center justify-center rounded-md border text-center text-sm
                    ${esPendiente ? "border-primary bg-primary/20" : "border-border bg-card"}
                  `}
                >
                  {celda.jugador?.nombre ?? ""}
                </button>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex w-full max-w-xs gap-2">
        <PlayerSearch
          players={jugadores}
          excludeNames={nombresUsados}
          onSelect={procesarSeleccion}
          disabled={celdasPendientes.length > 0}
          placeholder="Escribe un jugador..."
        />
        <GameButton variant="destructive" onClick={handleRendirse}>
          Rendirse
        </GameButton>
      </div>

      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}

      {resultado && (
        <GameResultDialog
          open={popupAbierto}
          onOpenChange={setPopupAbierto}
          resultado={resultado === "completado" ? "exito" : "fracaso"}
          titulo={resultado === "completado" ? "GRID COMPLETADO" : "GRID NO COMPLETADO"}
          descripcion={
            resultado === "completado" ? (
              <>
                Has resuelto las 9 casillas en{" "}
                <span className="font-semibold text-foreground">{tiempoFinal}</span>{" "}
                segundos.
              </>
            ) : (
              <>
                Te has rendido con{" "}
                <span className="font-semibold text-foreground">{celdasRellenas}/9</span>{" "}
                casillas resueltas.
              </>
            )
          }
          onJugarDeNuevo={jugarDeNuevo}
        />
      )}
    </div>
  );
}