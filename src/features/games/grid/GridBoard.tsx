// src/features/games/grid/GridBoard.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import type { Jugador } from "@/features/games/shared/types";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import type { Tablero, Celda } from "./type";
import { celdasValidasParaJugador, cumpleAmbasCondiciones } from "./logic";

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

async function contarSolucionesTodasLasCeldas(tablero: Tablero): Promise<Record<string, ResultadoCelda>> {
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

function CeldaDebug({
  datos,
  abierta,
  onToggle,
}: {
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
              {datos.truncado && <li className="text-[10px] italic text-muted-foreground">...y más</li>}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

// Foto del jugador a pantalla completa dentro de la casilla (o
// escudo/bandera/inicial si no hay foto real) -- ocupa toda la zona
// superior de la casilla acertada, con el nombre en una banda inferior
// del mismo verde que el marco.
// Foto del jugador de fondo, ocupando todo el cuadrado -- position
// absolute en vez de flex-1, para no depender de que el navegador
// combine bien "aspect-ratio" con un hijo flex que reparte el alto (esa
// mezcla puede colapsar a 0 en algunos casos).
function ImagenJugador({ jugador }: { jugador: Jugador }) {
  const club = jugador.equipos[jugador.equipos.length - 1];
  const codigoPais = obtenerCodigoPais(jugador.nacionalidad);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-secondary">
      {jugador.imagenUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={jugador.imagenUrl} alt="" className="h-full w-full object-cover object-top" />
      ) : club?.escudo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={club.escudo} alt="" className="h-2/3 w-2/3 object-contain" />
      ) : codigoPais ? (
        <span className={`fi fi-${codigoPais} text-4xl sm:text-5xl`} />
      ) : (
        <span className="text-3xl font-bold text-secondary-foreground sm:text-4xl">
          {jugador.nombre[0]}
        </span>
      )}
    </div>
  );
}

// Partículas habituales de apellidos compuestos -- si el nombre no cabe
// entero y hay que quedarse solo con el apellido, estas palabras se
// mantienen pegadas a él en vez de perderse ("De Bruyne", no "Bruyne").
const PARTICULAS_APELLIDO = new Set([
  "de", "del", "van", "von", "der", "den", "du", "la", "le", "dos", "das", "do", "da", "di", "al",
]);

const LIMITE_NOMBRE_COMPLETO = 12;

// Si el nombre completo es corto, se muestra entero. Si no, se queda
// solo con el apellido (con su partícula, si tiene) -- casi siempre
// entra en una línea, incluso con la letra más grande. El `truncate`
// del render es la red de seguridad final para el apellido larguísimo
// que aun así no quepa.
function nombreParaCasilla(nombreCompleto: string): string {
  if (nombreCompleto.length <= LIMITE_NOMBRE_COMPLETO) return nombreCompleto;

  const palabras = nombreCompleto.trim().split(/\s+/);
  if (palabras.length === 1) return nombreCompleto; // nombre de una sola palabra (Koke, Ederson...)

  let inicio = palabras.length - 1;
  while (inicio > 0 && PARTICULAS_APELLIDO.has(palabras[inicio - 1].toLowerCase())) {
    inicio--;
  }

  return palabras.slice(inicio).join(" ");
}

function CasillaGrid({
  celda,
  esPendiente,
  bloqueada,
  onClick,
}: {
  celda: Celda;
  esPendiente: boolean;
  bloqueada: boolean;
  onClick: () => void;
}) {
  if (celda.jugador) {
    return (
      <div className="relative aspect-square w-full animate-in overflow-hidden rounded-xl border-2 border-primary shadow-[0_0_24px_-4px_rgba(74,222,154,0.5)] duration-300 fade-in zoom-in-90">
        <ImagenJugador jugador={celda.jugador} />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-primary px-1.5 py-0.2">
          <p className="min-w-0 max-w-full truncate text-center text-xs font-extrabold uppercase text-primary-foreground sm:text-sm">
            {nombreParaCasilla(celda.jugador.nombre)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      disabled={bloqueada}
      onClick={onClick}
      className={`aspect-square w-full rounded-xl border transition-all duration-150
        ${
          esPendiente
            ? "animate-pulse border-primary bg-primary/15"
            : "border-border bg-card hover:border-primary/40 disabled:hover:border-border"
        }
        ${bloqueada && !esPendiente ? "opacity-40" : ""}
      `}
    />
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

  const cargaIdRef = useRef(0);


  useEffect(() => {
    cargarTablero();
  }, []);

  // cargaIdRef descarta resultados de peticiones obsoletas -- mismo patrón
  // que ya usa PlayerSearch. Hace falta porque React Strict Mode (activo
  // en `npm run dev`) ejecuta el useEffect de montaje dos veces a
  // propósito, lo que aquí pedía dos tableros aleatorios distintos y
  // hacía que se viera "parpadear" uno antes de que el otro lo
  // sustituyera. En producción esto no pasa (Strict Mode es solo de
  // desarrollo), pero así queda limpio también mientras trabajas.

  async function cargarTablero() {
    const miCargaId = ++cargaIdRef.current;

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

      if (miCargaId !== cargaIdRef.current) return; // esta carga ya quedó obsoleta

      setTablero(nuevoTablero);
      setHoraInicio(Date.now());

      if (DEBUG_HABILITADO) {
        contarSolucionesTodasLasCeldas(nuevoTablero).then((datos) => {
          if (miCargaId === cargaIdRef.current) setSolucionesDebug(datos);
        });
      }
    } catch (err) {
      if (miCargaId !== cargaIdRef.current) return;
      setErrorCarga(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      if (miCargaId === cargaIdRef.current) setCargando(false);
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
      setMensaje("");
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
    setMensaje("");
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
    <div className="flex flex-col items-center gap-6 p-4 sm:p-6">
      <div className="grid w-full max-w-md grid-cols-[minmax(0,0.7fr)_repeat(3,minmax(0,1fr))] gap-1.5 sm:gap-2">
        <div />
        {tablero.condicionesColumna.map((cond, i) => (
          <div
            key={i}
            className="flex items-center justify-center px-1 text-center text-xs font-semibold text-foreground sm:text-sm"
          >
            {cond.valor}
          </div>
        ))}

        {tablero.condicionesFila.map((condFila, fila) => (
          <div key={fila} className="contents">
            <div className="flex items-center justify-center px-1 text-center text-xs font-semibold text-foreground sm:text-sm">
              {condFila.valor}
            </div>

            {[0, 1, 2].map((columna) => {
              const celda = obtenerCelda(fila, columna);
              const esPendiente = celdasPendientes.some((c) => c.fila === fila && c.columna === columna);
              const clave = `${fila}-${columna}`;

              return (
                <div key={columna} className="relative">
                  <CasillaGrid
                    celda={celda}
                    esPendiente={esPendiente}
                    bloqueada={!esPendiente && celdasPendientes.length > 0}
                    onClick={() => {
                      if (esPendiente && jugadorPendiente) {
                        colocarJugador(jugadorPendiente, celda);
                      }
                    }}
                  />

                  {DEBUG_HABILITADO && celda.jugador === null && (
                    <CeldaDebug
                      datos={solucionesDebug[clave]}
                      abierta={celdaDebugAbierta === clave}
                      onToggle={() => setCeldaDebugAbierta((actual) => (actual === clave ? null : clave))}
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

      {mensaje && !resultado && <p className="text-sm text-muted-foreground">{mensaje}</p>}

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