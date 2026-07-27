// src/features/games/grid/GridBoard.tsx
"use client";

import { useEffect, useState } from "react";
import type { Jugador } from "@/features/games/shared/types";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import type { Tablero, Celda } from "./type";
import { celdasValidasParaJugador, cumpleAmbasCondiciones } from "./logic";

// Solo se activa fuera de producción: este panel muestra literalmente las
// respuestas de cada casilla, así que nunca debe verse en el juego real.
const DEBUG_HABILITADO = process.env.NODE_ENV !== "production";

type ResultadoCelda = { total: number; nombres: string[]; truncado: boolean };

function segundosTranscurridos(inicio: number): number {
  return Math.floor((Date.now() - inicio) / 1000);
}

async function buscarJugadores(query: string): Promise<Jugador[]> {
  const res = await fetch(`/api/jugadores/buscar?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Error al buscar jugadores");
  return res.json();
}

async function contarSolucionesTodasLasCeldas(
  tablero: Tablero
): Promise<Record<string, ResultadoCelda>> {
  const celdas = tablero.condicionesFila.flatMap((condicionFila, fila) =>
    tablero.condicionesColumna.map((condicionColumna, columna) => ({
      fila,
      columna,
      condicionFila,
      condicionColumna,
    }))
  );

  const res = await fetch("/api/tablero/contar-soluciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      celdas: celdas.map((c) => ({ condicionFila: c.condicionFila, condicionColumna: c.condicionColumna })),
    }),
  });

  if (!res.ok) return {};

  const { resultados } = (await res.json()) as { resultados: ResultadoCelda[] };
  const mapa: Record<string, ResultadoCelda> = {};
  celdas.forEach((c, i) => {
    if (resultados[i]) mapa[`${c.fila}-${c.columna}`] = resultados[i];
  });
  return mapa;
}

// Desplegable de depuración: esquina inferior derecha de una casilla,
// con el nº de soluciones y el listado al abrirlo.
function CeldaDebug({
  clave,
  datos,
  abierta,
  onToggle,
}: {
  clave: string;
  datos: ResultadoCelda | undefined;
  abierta: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="absolute bottom-1 right-1 z-10">
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        title="Ver soluciones (solo dev)"
        className="flex h-5 min-w-5 items-center justify-center rounded-full border border-border bg-muted px-1 text-[10px] font-semibold text-muted-foreground hover:bg-muted/70"
      >
        {datos ? datos.total : "…"}
      </button>

      {abierta && datos && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute bottom-full right-0 mb-1 w-52 max-h-48 overflow-y-auto rounded-md border border-input bg-popover p-2 text-left shadow-lg"
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {datos.total} solución{datos.total === 1 ? "" : "es"}
          </p>
          {datos.nombres.length === 0 ? (
            <p className="text-xs text-muted-foreground">Ninguna.</p>
          ) : (
            <ul className="space-y-0.5">
              {datos.nombres.map((nombre) => (
                <li key={nombre} className="truncate text-xs text-foreground">
                  {nombre}
                </li>
              ))}
              {datos.truncado && (
                <li className="text-[10px] italic text-muted-foreground">...y más</li>
              )}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

export function GridBoard() {
  const [tablero, setTablero] = useState<Tablero | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [mensaje, setMensaje] = useState("");
  const [celdasPendientes, setCeldasPendientes] = useState<Celda[]>([]);
  const [jugadorPendiente, setJugadorPendiente] = useState<Jugador | null>(null);

  const [horaInicio, setHoraInicio] = useState(() => Date.now());
  const [tiempoFinal, setTiempoFinal] = useState<number | null>(null);
  const [resultado, setResultado] = useState<"completado" | "rendido" | null>(null);
  const [popupAbierto, setPopupAbierto] = useState(false);

  const [solucionesDebug, setSolucionesDebug] = useState<Record<string, ResultadoCelda>>({});
  const [celdaDebugAbierta, setCeldaDebugAbierta] = useState<string | null>(null);

  useEffect(() => {
    cargarTablero();
  }, []);

  async function cargarTablero() {
    setCargando(true);
    setErrorCarga(null);
    setMensaje("");
    setCeldasPendientes([]);
    setJugadorPendiente(null);
    setTiempoFinal(null);
    setResultado(null);
    setPopupAbierto(false);
    setSolucionesDebug({});
    setCeldaDebugAbierta(null);

    try {
      const res = await fetch("/api/tablero/generar");
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo generar el tablero.");
      }
      const nuevoTablero: Tablero = await res.json();
      setTablero(nuevoTablero);
      setHoraInicio(Date.now());

      if (DEBUG_HABILITADO) {
        contarSolucionesTodasLasCeldas(nuevoTablero).then(setSolucionesDebug);
      }
    } catch (err) {
      setErrorCarga(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setCargando(false);
    }
  }

  function obtenerCelda(fila: number, columna: number): Celda {
    return tablero!.celdas.find((c) => c.fila === fila && c.columna === columna)!;
  }

  async function colocarJugador(jugador: Jugador, celdaElegida: Celda) {
    if (!tablero) return;

    const conJugadorPrincipal = tablero.celdas.map((c) =>
      c.fila === celdaElegida.fila && c.columna === celdaElegida.columna ? { ...c, jugador } : c
    );

    const otrasVacias = conJugadorPrincipal.filter(
      (c) =>
        c.jugador === null &&
        cumpleAmbasCondiciones(jugador, tablero.condicionesFila[c.fila], tablero.condicionesColumna[c.columna])
    );

    let celdasFinales = conJugadorPrincipal;
    let mensajeExtra = "";

    if (otrasVacias.length > 0) {
      try {
        const res = await fetch("/api/tablero/contar-soluciones", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            celdas: otrasVacias.map((c) => ({
              condicionFila: tablero.condicionesFila[c.fila],
              condicionColumna: tablero.condicionesColumna[c.columna],
            })),
          }),
        });

        if (res.ok) {
          const { resultados } = (await res.json()) as { resultados: ResultadoCelda[] };
          const celdasUnicas = otrasVacias.filter((_, i) => resultados[i]?.total === 1);

          if (celdasUnicas.length > 0) {
            const claves = new Set(celdasUnicas.map((c) => `${c.fila}-${c.columna}`));
            celdasFinales = conJugadorPrincipal.map((c) =>
              claves.has(`${c.fila}-${c.columna}`) ? { ...c, jugador } : c
            );
            mensajeExtra = ` ${jugador.nombre} era también la única solución posible para ${
              celdasUnicas.length === 1 ? "otra casilla" : `${celdasUnicas.length} casillas más`
            }, así que se ha marcado automáticamente.`;
          }
        }
      } catch (err) {
        console.error("No se pudo comprobar si había soluciones únicas adicionales", err);
      }
    }

    setTablero({ ...tablero, celdas: celdasFinales });
    setCeldasPendientes([]);
    setJugadorPendiente(null);
    setMensaje(`${jugador.nombre} colocado correctamente.${mensajeExtra}`);

    const todasLlenas = celdasFinales.every((c) => c.jugador !== null);
    if (todasLlenas) {
      setTiempoFinal(segundosTranscurridos(horaInicio));
      setResultado("completado");
      setPopupAbierto(true);
    }
  }

  function procesarSeleccion(jugador: Jugador) {
    if (!tablero) return;
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

  if (cargando) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-muted-foreground">Generando tablero...</p>
      </div>
    );
  }

  if (errorCarga || !tablero) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-destructive">{errorCarga ?? "No se pudo cargar el tablero."}</p>
        <GameButton onClick={cargarTablero}>Reintentar</GameButton>
      </div>
    );
  }

  const celdasRellenas = tablero.celdas.filter((c) => c.jugador !== null).length;
  const nombresUsados = tablero.celdas.filter((c) => c.jugador !== null).map((c) => c.jugador!.nombre);

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
              const esPendiente = celdasPendientes.some((c) => c.fila === fila && c.columna === columna);
              const clave = `${fila}-${columna}`;

              return (
                <div key={columna} className="relative">
                  <button
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

                  {DEBUG_HABILITADO && celda.jugador === null && (
                    <CeldaDebug
                      clave={clave}
                      datos={solucionesDebug[clave]}
                      abierta={celdaDebugAbierta === clave}
                      onToggle={() =>
                        setCeldaDebugAbierta((actual) => (actual === clave ? null : clave))
                      }
                    />
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div className="flex w-full max-w-xs gap-2">
        <PlayerSearch
          onSearch={buscarJugadores}
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
                <span className="font-semibold text-foreground">{tiempoFinal}</span> segundos.
              </>
            ) : (
              <>
                Te has rendido con{" "}
                <span className="font-semibold text-foreground">{celdasRellenas}/9</span> casillas resueltas.
              </>
            )
          }
          onJugarDeNuevo={cargarTablero}
        />
      )}
    </div>
  );
}