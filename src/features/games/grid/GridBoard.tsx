// src/features/games/grid/GridBoard.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { CircleCheck } from "lucide-react";
import type { Jugador, Dificultad } from "@/features/games/shared/types";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import { useRegistrarPartida } from "@/features/games/shared/useRegistrarPartida";
import type { RespuestaPartida } from "@/lib/experiencia";
import type { Tablero, Celda, Condicion } from "./type";
import { celdasValidasParaJugador, cumpleAmbasCondiciones } from "./logic";

const ETIQUETA_DIFICULTAD: Record<Dificultad, string> = {
  facil: "Fácil",
  medio: "Medio",
  dificil: "Difícil",
};

const DEBUG_HABILITADO = process.env.NODE_ENV !== "production";

// El botoncito por casilla que revela las soluciones (CeldaDebug, más abajo)
// se deshabilita aquí a propósito -- no se borra el mecanismo porque
// `solucionesDebug` es justo el dato que hará falta para la futura función
// de "mostrar todas las respuestas correctas" al terminar la partida (tras
// ver un anuncio). De momento solo se apaga la UI que lo muestra por
// casilla mientras se juega.
const MOSTRAR_BOTON_SOLUCIONES_CELDA = false;

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
  const palabras = nombreCompleto.trim().split(/\s+/);
  if (palabras.length === 1) return nombreCompleto;

  let inicio = palabras.length - 1;
  while (inicio > 0 && PARTICULAS_APELLIDO.has(palabras[inicio - 1].toLowerCase())) {
    inicio--;
  }

  return palabras.slice(inicio).join(" ");
}

// Cabecera de fila/columna: escudo del equipo o bandera de la selección
// encima del nombre, en vez de solo texto. Si el equipo todavía no tiene
// escudo guardado (ver scripts/equipos/sync-escudos-equipos.ts), cae al texto
// solo, igual que antes.
function EncabezadoCondicion({ condicion }: { condicion: Condicion }) {
  const codigoPais = condicion.tipo === "nacionalidad" ? obtenerCodigoPais(condicion.valor) : null;
  const texto = condicion.valor;

  return (
    <div className="isolate flex flex-col items-center justify-center gap-1 px-1 text-center [container-type:inline-size]">
      {condicion.tipo === "equipo" && condicion.escudo ? (
        // Tamaño calibrado a ojo para que pese visualmente parecido a la
        // bandera de abajo (las banderas son más anchas que altas por
        // naturaleza, los escudos casi cuadrados -- no van a medir
        // exactamente lo mismo, pero con esto no se nota descompensado).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={condicion.escudo}
          alt=""
          className="h-9 w-9 shrink-0 object-contain mix-blend-multiply sm:h-11 sm:w-11"
        />
      ) : codigoPais ? (
        <span className={`fi fi-${codigoPais} shrink-0 text-3xl sm:text-4xl`} />
      ) : null}
      {/* clamp() ligado al ancho del contenedor ([container-type:inline-size]
          en el div de arriba): el texto se encoge solo si no cabe. El
          truncate es la red de seguridad final, igual que en
          nombreParaCasilla. */}
      <p className="min-w-0 max-w-full truncate text-[clamp(0.6rem,9cqw,0.85rem)] font-semibold text-foreground">
        {texto}
      </p>
    </div>
  );
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
      <div className="relative aspect-square w-full animate-in overflow-hidden rounded-xl border-2 border-primary shadow-[0_0_24px_-4px_rgba(74,222,154,0.5)] duration-300 fade-in zoom-in-90 [container-type:inline-size]">
        <ImagenJugador jugador={celda.jugador} />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-primary px-1.5 py-1">
          <p className="min-w-0 max-w-full truncate text-center font-extrabold uppercase text-primary-foreground text-[clamp(0.55rem,7.5cqw,0.9rem)]">
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
      // touch-manipulation + select-none: mismo motivo que en GameButton --
      // sin esto, el retraso táctil por defecto del navegador (esperando a
      // ver si es un doble-tap de zoom) es justo lo que hacía sentir la
      // selección de casilla "rarita" en móvil, sobre todo con el dedo
      // haciendo un mínimo movimiento mientras tocas una casilla pequeña.
      className={`aspect-square w-full touch-manipulation select-none rounded-xl border transition-all duration-150
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

// Para cada jugador ya colocado en el tablero, en qué casilla ("fila-col")
// se colocó -- lo usa ListaNombresCelda para saber, al listar las
// soluciones de UNA casilla, si un nombre de esa lista es justo el que
// colocó el usuario ahí (acierto, verde), si lo colocó en OTRA casilla
// (ya "gastado", rojo tachado), o si no lo ha usado en ninguna (neutro).
function construirMapaUsoPorNombre(tablero: Tablero): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const celda of tablero.celdas) {
    if (celda.jugador) mapa.set(celda.jugador.nombre, `${celda.fila}-${celda.columna}`);
  }
  return mapa;
}

// Lista de nombres de una casilla, coloreada según dónde (si acaso) usó el
// usuario cada nombre. El propio acierto de esta casilla (`nombrePropio`)
// se antepone a mano si no aparece en `celda.nombres` -- puede faltar
// porque el servidor trunca la lista a LIMITE_NOMBRES (ver
// indiceEquipos.server.ts), y el acierto del jugador tiene que verse
// siempre, aunque quede fuera del orden alfabético normal.
function ListaNombresCelda({
  celda,
  claveCelda,
  nombrePropio,
  usoPorNombre,
}: {
  celda: ResultadoCelda;
  claveCelda: string;
  nombrePropio: string | null;
  usoPorNombre: Map<string, string>;
}) {
  if (celda.nombres.length === 0) {
    return <p className="text-muted-foreground">Sin soluciones registradas.</p>;
  }

  const nombres =
    nombrePropio && !celda.nombres.includes(nombrePropio) ? [nombrePropio, ...celda.nombres] : celda.nombres;

  return (
    <p className="leading-relaxed">
      {nombres.map((nombre, i) => {
        const claveDondeSeUso = usoPorNombre.get(nombre);
        const acertadoAqui = claveDondeSeUso === claveCelda;
        const usadoEnOtra = claveDondeSeUso !== undefined && !acertadoAqui;

        return (
          <span
            key={nombre}
            className={
              acertadoAqui
                ? "font-semibold text-primary"
                : usadoEnOtra
                  ? "text-destructive line-through decoration-2"
                  : "text-muted-foreground"
            }
          >
            {nombre}
            {i < nombres.length - 1 ? ", " : ""}
          </span>
        );
      })}
      {celda.truncado ? "…" : ""}
    </p>
  );
}

// Texto (no popup) con las respuestas correctas de las 9 casillas, para
// desplegar dentro del propio cartel de resultado. Reusa el mismo
// endpoint/formato que antes alimentaba el popup de soluciones por casilla
// en modo debug (ver ResultadoCelda más arriba). A diferencia de la
// versión anterior (que solo listaba las casillas vacías al rendirse),
// ahora se muestran las 9 siempre -- también tras completar el tablero,
// para poder ver en verde lo acertado y en rojo tachado lo que se usó en
// otra casilla.
function TextoRespuestasCorrectas({
  tablero,
  datos,
  cargando,
}: {
  tablero: Tablero;
  datos: Record<string, ResultadoCelda> | null;
  cargando: boolean;
}) {
  if (cargando || !datos) {
    return <p className="text-sm text-muted-foreground">Cargando respuestas...</p>;
  }

  const usoPorNombre = construirMapaUsoPorNombre(tablero);

  return (
    <div className="w-full space-y-2 text-left">
      <p className="text-[11px] leading-snug text-muted-foreground">
        <span className="font-semibold text-primary">Verde</span>: lo que acertaste aquí ·{" "}
        <span className="font-semibold text-destructive line-through">Rojo tachado</span>: lo usaste en otra
        casilla
      </p>

      <div className="max-h-72 w-full space-y-3 overflow-y-auto rounded-lg border border-border bg-background/60 p-3">
        {tablero.condicionesFila.map((condFila, fila) => (
          <div key={fila} className="space-y-1.5">
            {[0, 1, 2].map((columna) => {
              const condColumna = tablero.condicionesColumna[columna];
              const clave = `${fila}-${columna}`;
              const celda = datos[clave];
              const celdaTablero = obtenerCeldaEstatica(tablero, fila, columna);
              const nombrePropio = celdaTablero?.jugador?.nombre ?? null;

              return (
                <div key={columna} className="text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    {condFila.valor} · {condColumna.valor}
                    {nombrePropio && <CircleCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </p>
                  {celda ? (
                    <ListaNombresCelda
                      celda={celda}
                      claveCelda={clave}
                      nombrePropio={nombrePropio}
                      usoPorNombre={usoPorNombre}
                    />
                  ) : (
                    <p className="text-muted-foreground">Sin datos.</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function obtenerCeldaEstatica(tablero: Tablero, fila: number, columna: number): Celda | undefined {
  return tablero.celdas.find((c) => c.fila === fila && c.columna === columna);
}

export function GridBoard({ dificultad }: { dificultad: Dificultad }) {
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
  const [experiencia, setExperiencia] = useState<RespuestaPartida | null>(null);
  const registrarPartida = useRegistrarPartida();

  const [solucionesDebug, setSolucionesDebug] = useState<Record<string, ResultadoCelda>>({});
  const [celdaDebugAbierta, setCeldaDebugAbierta] = useState<string | null>(null);

  // Respuestas correctas al terminar la partida (victoria o rendición) --
  // se piden bajo demanda (solo al pulsar el botón, no siempre) y se
  // guardan en caché aquí para no repetir la petición si se pliega y se
  // vuelve a desplegar el texto.
  const [respuestasCorrectas, setRespuestasCorrectas] = useState<Record<string, ResultadoCelda> | null>(null);
  const [cargandoRespuestas, setCargandoRespuestas] = useState(false);
  const [mostrandoRespuestas, setMostrandoRespuestas] = useState(false);

  const cargaIdRef = useRef(0);


  // `dificultad` no cambia tras el montaje (GameLauncher desmonta el
  // selector en cuanto se elige una y monta GridBoard ya con la elegida
  // fijada), así que no hace falta re-suscribirse a sus cambios -- mismo
  // razonamiento que ya llevaba este efecto con el array vacío.
  useEffect(() => {
    cargarTablero();
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    setRespuestasCorrectas(null);
    setCargandoRespuestas(false);
    setMostrandoRespuestas(false);
    setExperiencia(null);

    try {
      const res = await fetch(`/api/tablero/generar?dificultad=${dificultad}`);
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
      // Se calcula una sola vez y se reusa -- llamar dos veces a
      // segundosTranscurridos() (una para el marcador, otra para el
      // registro) podría dar dos valores ligeramente distintos y
      // desincronizar lo que se ve del tiempo real que se registra.
      const segundos = segundosTranscurridos(horaInicio);
      setMensaje("");
      setTiempoFinal(segundos);
      setResultado("completado");
      setPopupAbierto(true);
      registrarPartida("GRID", dificultad, "victoria", segundos).then(setExperiencia);
    }
  }

  function procesarSeleccion(jugador: Jugador) {
    // Guarda defensiva a mayores del `disabled` de <PlayerSearch> --
    // aunque el input esté deshabilitado, esto cierra la puerta a que un
    // onSelect suelto (o una tecla como Enter en un estado intermedio)
    // pudiera colocar un jugador después de haber terminado la partida.
    if (!tablero || resultado !== null) return;
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
    // Bug corregido: antes, si te rendías con una selección "pendiente"
    // (nombre válido para varias casillas, esperando a que elijas una), esa
    // selección se quedaba viva -- cerrabas el cartel de resultado y
    // seguías pudiendo colocarla, como si no te hubieras rendido. Al
    // limpiar aquí celdasPendientes/jugadorPendiente, y con el bloqueo por
    // `resultado !== null` de más abajo (buscador, casillas y este mismo
    // botón), rendirse deja el tablero congelado de verdad.
    setCeldasPendientes([]);
    setJugadorPendiente(null);
    setTiempoFinal(segundosTranscurridos(horaInicio));
    setResultado("rendido");
    setPopupAbierto(true);
    // Se registra igual que una victoria (para que "partidas jugadas" y la
    // racha reflejen la realidad), pero sin guardar la respuesta en
    // `experiencia` -- GameResultDialog solo la enseña en victorias, y
    // aquí expGanada siempre es 0 de todas formas.
    registrarPartida("GRID", dificultad, "derrota");
  }

  // Alterna el texto de respuestas correctas dentro del propio cartel de
  // resultado. Solo pide los datos al servidor la primera vez que se
  // despliega -- si ya se pidieron, plegar y volver a desplegar reutiliza
  // lo que ya hay en `respuestasCorrectas`.
  async function alternarRespuestasCorrectas() {
    if (mostrandoRespuestas) {
      setMostrandoRespuestas(false);
      return;
    }

    setMostrandoRespuestas(true);
    if (!respuestasCorrectas && tablero) {
      setCargandoRespuestas(true);
      const datos = await contarSolucionesTodasLasCeldas(tablero);
      setRespuestasCorrectas(datos);
      setCargandoRespuestas(false);
    }
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
          <EncabezadoCondicion key={i} condicion={cond} />
        ))}

        {tablero.condicionesFila.map((condFila, fila) => (
          <div key={fila} className="contents">
            <EncabezadoCondicion condicion={condFila} />

            {[0, 1, 2].map((columna) => {
              const celda = obtenerCelda(fila, columna);
              const esPendiente = celdasPendientes.some((c) => c.fila === fila && c.columna === columna);
              const clave = `${fila}-${columna}`;

              return (
                <div key={columna} className="relative">
                  <CasillaGrid
                    celda={celda}
                    esPendiente={esPendiente}
                    bloqueada={(!esPendiente && celdasPendientes.length > 0) || resultado !== null}
                    onClick={() => {
                      if (esPendiente && jugadorPendiente && resultado === null) {
                        colocarJugador(jugadorPendiente, celda);
                      }
                    }}
                  />

                  {MOSTRAR_BOTON_SOLUCIONES_CELDA && DEBUG_HABILITADO && celda.jugador === null && (
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
          disabled={celdasPendientes.length > 0 || resultado !== null}
          placeholder="Escribe un jugador..."
        />
        <GameButton variant="destructive" onClick={handleRendirse} disabled={resultado !== null}>
          Rendirse
        </GameButton>
      </div>

      <div className="flex items-center gap-3">
        <GameButton variant="secondary" onClick={cargarTablero}>
          Regenerar tablero
        </GameButton>
        <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          Nivel: {ETIQUETA_DIFICULTAD[dificultad]}
        </span>
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
          experiencia={experiencia}
          respuestasCorrectas={{
            mostrando: mostrandoRespuestas,
            onToggle: alternarRespuestasCorrectas,
            contenido: (
              <TextoRespuestasCorrectas
                tablero={tablero}
                datos={respuestasCorrectas}
                cargando={cargandoRespuestas}
              />
            ),
          }}
        />
      )}
    </div>
  );
}