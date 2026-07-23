"use client";

import { useState } from "react";
import type { Tablero, Celda, Jugador } from "./type";
import { jugadores, tableroEjemplo } from "./data";
import { celdasValidasParaJugador } from "./logic";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

function segundosTranscurridos(inicio: number): number {
  return Math.floor((Date.now() - inicio) / 1000);
}

export function GridBoard() {
  const [tablero, setTablero] = useState<Tablero>(tableroEjemplo);
  const [nombreBuscado, setNombreBuscado] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [celdasPendientes, setCeldasPendientes] = useState<Celda[]>([]);
  const [jugadorPendiente, setJugadorPendiente] = useState<Jugador | null>(null);

  const [horaInicio] = useState(() => Date.now());
  const [tiempoFinal, setTiempoFinal] = useState<number | null>(null);
  const completado = tiempoFinal !== null;

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
    setNombreBuscado("");
    setMensaje(`${jugador.nombre} colocado correctamente.`);

    const todasLlenas = nuevasCeldas.every((c) => c.jugador !== null);
    if (todasLlenas) {
      setTiempoFinal(segundosTranscurridos(horaInicio));
    }
  }

  function handleBuscar() {
    const jugador = jugadores.find(
      (j) => j.nombre.toLowerCase() === nombreBuscado.trim().toLowerCase()
    );

    if (!jugador) {
      setMensaje("No se ha encontrado ese jugador.");
      return;
    }

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

      <div className="flex gap-2">
        <input
          value={nombreBuscado}
          onChange={(e) => setNombreBuscado(e.target.value)}
          placeholder="Escribe un jugador..."
          className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
        />
        <button
          onClick={handleBuscar}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
        >
          Comprobar
        </button>
      </div>

      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}

      <Dialog open={completado}>
        <DialogContent className="border-primary/30 bg-card text-center sm:max-w-md">
          <DialogHeader className="items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/15 text-3xl">
              🏆
            </div>
            <DialogTitle className="text-4xl font-extrabold tracking-tight text-primary">
              GRID COMPLETADO
            </DialogTitle>
            <DialogDescription className="text-base text-muted-foreground">
              Has resuelto las 9 casillas en{" "}
              <span className="font-semibold text-foreground">{tiempoFinal}</span>{" "}
              segundos.
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
}