"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, Link2, RotateCcw as UndoIcon } from "lucide-react";
import type { Dificultad, Equipo, Jugador } from "@/features/games/shared/types";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import { ConfirmDialog } from "@/features/games/shared/ConfirmDialog";
import { useRegistrarPartida } from "@/features/games/shared/useRegistrarPartida";
import type { RespuestaPartida } from "@/lib/experiencia";
import type { PartidaGenerada, PasoCadena, PistaEtapa, ResultadoConexion } from "./type";

function segundosTranscurridos(inicio: number): number {
  return Math.floor((Date.now() - inicio) / 1000);
}

// La UI habla en "jugadores intermedios" (los que van entre el inicial y
// el final: "Jugador inicial - j1 - j2 - j3 - Jugador final" = 3
// jugadores intermedios), no en "Steps"/conexiones -- petición del
// usuario (11/08/2026). Internamente el BFS sigue calculando en
// conexiones (`distanciaMinima`, ver generarPartida.server.ts), que es
// siempre un jugador intermedio más que el número que se enseña aquí.
function etiquetaJugadoresIntermedios(n: number): string {
  return n === 1 ? "jugador intermedio" : "jugadores intermedios";
}

async function buscarJugadores(query: string): Promise<Jugador[]> {
  const res = await fetch(`/api/jugadores/buscar?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Error al buscar jugadores");
  return res.json();
}

// Convierte las etapas de un candidato del buscador (Equipo, con
// desde/hasta/cedido ya rellenos desde /api/jugadores/buscar) al formato
// PistaEtapa que espera EslabonCadena para su desplegable "Carrera"
// (12/08/2026, Opción B elegida por el usuario tras ver 3 mockups).
// "cedido" (2ª ronda, mismo día): al principio el buscador no lo
// calculaba y esta función lo omitía -- el usuario pidió explícitamente
// que el desplegable de los intermedios marcase cesiones igual que las
// tarjetas de inicio/final, así que ahora /api/jugadores/buscar también
// lo calcula (mismo criterio de solape que marcarCesiones en
// grafoJugadores.server.ts) y aquí solo se traslada.
function pistasDeEquipos(equipos: Equipo[]): PistaEtapa[] {
  return equipos.map((equipo) => ({
    equipo: equipo.nombre,
    temporada: equipo.desde ? `${equipo.desde} - ${equipo.hasta ?? "actualidad"}` : undefined,
    // cedido (12/08/2026, 2ª ronda): ya viene calculado desde
    // /api/jugadores/buscar (mismo criterio de solape que las tarjetas de
    // inicio/final), solo hay que pasarlo tal cual.
    cedido: equipo.cedido,
  }));
}

async function verificarConexionApi(actual: string, siguiente: string): Promise<ResultadoConexion> {
  const res = await fetch("/api/jugadores/enlazar/verificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actual, siguiente }),
  });
  if (!res.ok) throw new Error("No se pudo comprobar la conexión.");
  return res.json();
}

// Pistas de Stints bajo el nombre -- equipo + años de cada etapa, igual
// en las tres dificultades (ver PistaEtapa en type.ts).
//
// Rediseñado (11/08/2026, petición del usuario): antes eran chips en
// flex-wrap centrados, que con muchas etapas (jugadores con carreras
// largas) quedaban desordenados y difíciles de leer de un vistazo. Ahora
// cada etapa es su propia línea, alineada a la izquierda -- equipo a la
// izquierda, años a la derecha de esa misma línea -- dentro de una lista
// con scroll propio si hay muchas, para no descuadrar el alto de las dos
// tarjetas (inicial/final) cuando una tiene una carrera mucho más larga
// que la otra.
//
// Etiqueta "cedido" (11/08/2026, 5ª ronda): cuando una etapa se solapa en
// el tiempo con otra etapa anterior (de otro club) del mismo jugador --
// típicamente porque un club sigue "actualidad" (sin fecha de fin) y
// aparece otro club después ya cerrado -- se marca como probable cesión
// (ver marcarCesiones en grafoJugadores.server.ts) para que no parezca un
// hueco raro en la cronología: el jugador sigue de contrato en el primer
// club mientras juega cedido en el segundo.
// Filas compartidas por PistasEtapas (tarjetas inicio/final) y el
// desplegable "Carrera" de cada eslabón de la cadena (ver EslabonCadena
// más abajo) -- misma línea por etapa, equipo a la izquierda y años a la
// derecha, solo cambia el contenedor `<ul>` que las envuelve en cada
// sitio.
function FilasPistas({ pistas, colorTexto }: { pistas: PistaEtapa[]; colorTexto: string }) {
  return (
    <>
      {pistas.map((pista, i) => (
        <li
          key={i}
          className="flex items-baseline gap-2 rounded px-1.5 py-0.5 text-left text-[11px] odd:bg-white/[0.03]"
        >
          <span className="flex min-w-0 items-baseline gap-1">
            <span className={`truncate font-medium ${colorTexto}`}>{pista.equipo}</span>
            {pista.cedido && (
              <span className="shrink-0 rounded-full border border-white/10 px-1 py-px text-[8px] font-semibold uppercase tracking-wide text-muted-foreground">
                Cedido
              </span>
            )}
          </span>
          {pista.temporada && <span className="ml-auto shrink-0 text-muted-foreground">{pista.temporada}</span>}
        </li>
      ))}
    </>
  );
}

function PistasEtapas({ pistas, acento }: { pistas: PistaEtapa[]; acento: "primary" | "secondary" }) {
  if (pistas.length === 0) return null;

  const colorTexto = acento === "primary" ? "text-primary" : "text-secondary";

  return (
    <ul className="flex max-h-40 w-full flex-col gap-0.5 overflow-y-auto rounded-lg border border-white/10 bg-background/40 p-1.5">
      <FilasPistas pistas={pistas} colorTexto={colorTexto} />
    </ul>
  );
}

// Tarjeta COMPACTA de jugador inicial/final -- solo cabecera (avatar +
// nombre + botón "Carrera"), sin la lista de etapas dentro. Rediseñado
// (12/08/2026, mockup elegido por el usuario -- "opción 2, pero que cada
// botón se pueda apagar/encender por separado, y si se abren los dos que
// salgan uno encima de otro"): antes cada tarjeta llevaba su lista de
// etapas siempre visible dentro, lo que en móvil, en fila, no dejaba
// espacio para leerlas. Ahora las dos cabeceras van juntas y compactas
// (caben perfectamente en fila incluso en móvil, ya no hace que apilarlas
// en vertical) y el despliegue de la carrera lo controla el componente de
// arriba (TarjetasObjetivo) para que los dos paneles aparezcan fuera de
// las columnas, a todo el ancho.
function TarjetaObjetivoCompacta({
  titulo,
  nombre,
  nacionalidad,
  imagenUrl,
  tieneCarrera,
  abierta,
  onToggleCarrera,
  acento,
}: {
  titulo: string;
  nombre: string;
  nacionalidad: string;
  imagenUrl: string | null;
  tieneCarrera: boolean;
  abierta: boolean;
  onToggleCarrera: () => void;
  acento: "primary" | "secondary";
}) {
  const codigoPais = obtenerCodigoPais(nacionalidad);
  const colorTexto = acento === "primary" ? "text-primary" : "text-secondary";
  const colorBorde = acento === "primary" ? "border-primary/40 bg-primary/10" : "border-secondary/40 bg-secondary/10";

  return (
    // min-w-0 (12/08/2026, arreglo de móvil): sin esto, un flex item con
    // flex-1 NO se encoge por debajo del ancho de su contenido más largo
    // (comportamiento por defecto de flexbox, min-width:auto) -- con un
    // nombre largo, la tarjeta se negaba a estrecharse y empujaba el ancho
    // total fuera de la pantalla, en vez de dejar que el nombre se
    // recortara con truncate como ya estaba pensado.
    <div className={`flex w-full min-w-0 flex-1 flex-col items-center gap-2 rounded-2xl border p-3 text-center ${colorBorde}`}>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${colorTexto}`}>{titulo}</span>
      <div className="h-12 w-12 shrink-0 overflow-hidden rounded-full bg-gradient-to-br from-secondary to-primary/60 ring-1 ring-white/10 sm:h-14 sm:w-14">
        {imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg font-bold text-secondary-foreground">
            {nombre[0]}
          </span>
        )}
      </div>
      <div className="flex w-full min-w-0 items-center justify-center gap-1.5">
        {codigoPais && <span className={`fi fi-${codigoPais} h-3 w-4 shrink-0 rounded-sm`} />}
        <p className="min-w-0 truncate text-sm font-semibold text-foreground">{nombre}</p>
      </div>
      {tieneCarrera && (
        <button
          type="button"
          onClick={onToggleCarrera}
          className={`inline-flex shrink-0 items-center gap-1 rounded-full border px-2.5 py-1 text-[10.5px] font-semibold transition-colors ${
            abierta ? "border-white/20 text-foreground" : "border-white/10 text-muted-foreground hover:text-foreground"
          }`}
        >
          Carrera
          <ChevronDown className={`h-2.5 w-2.5 shrink-0 transition-transform ${abierta ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

// Fila de las dos cabeceras (inicial/final) + los paneles de carrera
// desplegados debajo, a todo el ancho -- cada botón "Carrera" se
// activa/desactiva por separado (no son pestañas excluyentes: se puede
// tener las dos abiertas a la vez, cerradas las dos, o solo una), y si
// las dos están abiertas se apilan una encima de otra en el orden
// inicial → final. Ambas empiezan cerradas -- nada se enseña hasta que se
// pulsa, para que la fila de arriba se quede siempre compacta.
//
// Exportado (12/08/2026, petición del usuario: "el multijugador tiene que
// verse EXACTAMENTE igual que el modo individual") -- SeccionLinkPlayers
// en multijugador/sala/[codigo]/partida/page.tsx reutiliza este mismo
// componente en vez de una versión propia, para que se vea pixel a pixel
// igual en los dos modos, comportamiento de los botones incluido.
export function TarjetasObjetivo({
  jugadorInicial,
  jugadorFinal,
}: {
  jugadorInicial: { nombre: string; nacionalidad: string; imagenUrl: string | null; pistas?: PistaEtapa[] };
  jugadorFinal: { nombre: string; nacionalidad: string; imagenUrl: string | null; pistas?: PistaEtapa[] };
}) {
  const [mostrarInicial, setMostrarInicial] = useState(false);
  const [mostrarFinal, setMostrarFinal] = useState(false);

  return (
    <div className="flex w-full flex-col gap-3">
      <div className="flex w-full gap-3">
        <TarjetaObjetivoCompacta
          titulo="Jugador inicial"
          nombre={jugadorInicial.nombre}
          nacionalidad={jugadorInicial.nacionalidad}
          imagenUrl={jugadorInicial.imagenUrl}
          tieneCarrera={!!jugadorInicial.pistas && jugadorInicial.pistas.length > 0}
          abierta={mostrarInicial}
          onToggleCarrera={() => setMostrarInicial((v) => !v)}
          acento="primary"
        />
        <TarjetaObjetivoCompacta
          titulo="Jugador final"
          nombre={jugadorFinal.nombre}
          nacionalidad={jugadorFinal.nacionalidad}
          imagenUrl={jugadorFinal.imagenUrl}
          tieneCarrera={!!jugadorFinal.pistas && jugadorFinal.pistas.length > 0}
          abierta={mostrarFinal}
          onToggleCarrera={() => setMostrarFinal((v) => !v)}
          acento="secondary"
        />
      </div>

      {mostrarInicial && jugadorInicial.pistas && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-primary">
            Carrera de {jugadorInicial.nombre}
          </span>
          <PistasEtapas pistas={jugadorInicial.pistas} acento="primary" />
        </div>
      )}
      {mostrarFinal && jugadorFinal.pistas && (
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-secondary">
            Carrera de {jugadorFinal.nombre}
          </span>
          <PistasEtapas pistas={jugadorFinal.pistas} acento="secondary" />
        </div>
      )}
    </div>
  );
}

// Avatar redondo (foto o inicial sobre degradado) con la bandera como
// insignia en la esquina -- mismo lenguaje visual que ya usan
// TarjetaObjetivo y PlayerSearch, para que la cadena se sienta parte del
// mismo sistema en vez de una lista de texto suelta.
function AvatarEslabon({ nombre, nacionalidad, imagenUrl }: { nombre: string; nacionalidad: string; imagenUrl: string | null }) {
  const codigoPais = obtenerCodigoPais(nacionalidad);

  return (
    <div className="relative h-10 w-10 shrink-0">
      <div className="h-10 w-10 overflow-hidden rounded-full bg-gradient-to-br from-secondary to-primary/60 ring-1 ring-white/10">
        {imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-sm font-bold text-secondary-foreground">
            {nombre[0]}
          </span>
        )}
      </div>
      {codigoPais && (
        <span
          className={`fi fi-${codigoPais} absolute -bottom-0.5 -right-0.5 h-3 w-4 rounded-[2px] shadow-[0_0_0_2px_var(--card)]`}
        />
      )}
    </div>
  );
}

// Rediseñado (12/08/2026, petición del usuario: "la manera en la que se
// visualizan los steps" no le convencía) -- antes cada paso era una caja
// de solo texto con una línea "Jugaron juntos en X (años)" suelta encima.
// Ahora es una línea de tiempo de verdad: avatar de cada jugador (mismo
// componente que las tarjetas de inicio/final) conectados por una línea
// vertical, con la conexión (club + años) como una píldora sobre esa
// línea en vez de una frase completa -- más compacto y más fácil de leer
// de un vistazo según la cadena crece.
// Opción B (12/08/2026, elegida por el usuario entre 3 mockups): la
// tarjeta se queda compacta por defecto, igual que antes. Solo si este
// jugador trae pistas (los intermedios que coloca el propio usuario
// siempre las traen, ver manejarSeleccion; jugadorInicial/jugadorFinal y
// el camino de la solución también) aparece el botón "Carrera" que
// despliega su lista de etapas debajo -- así se puede consultar la
// carrera de un jugador ya colocado para decidir si conviene revertirlo,
// sin que la cadena se alargue de más cuando no hace falta consultarla.
export function EslabonCadena({ paso, esFinal }: { paso: PasoCadena; esFinal: boolean }) {
  const [expandido, setExpandido] = useState(false);
  const pistas = paso.jugador.pistas;
  const tienePistas = !!pistas && pistas.length > 0;
  const colorTexto = esFinal ? "text-secondary" : "text-primary";

  return (
    <li className="relative">
      {paso.conexion && (
        <div className="flex items-center gap-2 py-1 pl-5">
          <span className="h-5 w-px shrink-0 bg-gradient-to-b from-white/25 to-white/10" />
          <span className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-white/10 bg-card/60 px-2.5 py-1 text-[11px]">
            <Link2 className="h-3 w-3 shrink-0 text-primary" />
            <span className="truncate font-medium text-foreground">{paso.conexion.equipo}</span>
            <span className="shrink-0 text-muted-foreground">· {paso.conexion.temporada}</span>
          </span>
        </div>
      )}
      <div
        className={`flex items-center gap-3 border px-3 py-2 ${
          expandido && tienePistas ? "rounded-t-xl border-b-0" : "rounded-xl"
        } ${esFinal ? "border-secondary/50 bg-secondary/10" : "border-white/10 bg-card/60"}`}
      >
        <AvatarEslabon nombre={paso.jugador.nombre} nacionalidad={paso.jugador.nacionalidad} imagenUrl={paso.jugador.imagenUrl} />
        <span className="flex-1 truncate text-sm font-medium text-foreground">{paso.jugador.nombre}</span>
        {tienePistas && (
          <button
            type="button"
            onClick={() => setExpandido((v) => !v)}
            className="inline-flex shrink-0 items-center gap-1 rounded-full border border-white/10 px-2.5 py-1 text-[10.5px] font-semibold text-muted-foreground transition-colors hover:text-foreground"
          >
            Carrera
            <ChevronDown className={`h-2.5 w-2.5 shrink-0 transition-transform ${expandido ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>
      {expandido && tienePistas && (
        <ul className="flex w-full flex-col gap-0.5 rounded-b-xl border border-t-0 border-white/10 bg-background/40 p-1.5">
          <FilasPistas pistas={pistas} colorTexto={colorTexto} />
        </ul>
      )}
    </li>
  );
}

// Bloque que se despliega en el cartel de resultado al pulsar "Mostrar
// respuestas correctas" -- reutiliza EslabonCadena para enseñar el camino
// más corto REAL (no solo su longitud) que ya venía en la respuesta de
// /api/jugadores/enlazar/generar desde el principio de la partida, solo
// que sin renderizar hasta ahora. Petición explícita del usuario
// (11/08/2026): antes solo se veía el número de Steps del mínimo, no el
// camino en sí, y quería poder consultarlo al perder/rendirse.
function CaminoSolucion({ camino }: { camino: PasoCadena[] }) {
  return (
    <ul className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-background/40 p-3 text-left">
      {camino.map((paso, i) => (
        <EslabonCadena key={`${paso.jugador.nombre}-${i}`} paso={paso} esFinal={i === camino.length - 1} />
      ))}
    </ul>
  );
}

export function LinkPlayersGame({ dificultad }: { dificultad: Dificultad }) {
  const [partida, setPartida] = useState<PartidaGenerada | null>(null);
  const [cadena, setCadena] = useState<PasoCadena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [horaInicio, setHoraInicio] = useState(() => Date.now());
  const [tiempoFinal, setTiempoFinal] = useState<number | null>(null);
  const [rendido, setRendido] = useState(false);
  const [popupAbierto, setPopupAbierto] = useState(false);
  const [mostrandoCamino, setMostrandoCamino] = useState(false);
  const [experiencia, setExperiencia] = useState<RespuestaPartida | null>(null);
  const registrarPartida = useRegistrarPartida();

  const [confirmandoNuevaPartida, setConfirmandoNuevaPartida] = useState(false);
  const [confirmandoRendicion, setConfirmandoRendicion] = useState(false);

  // Mismo patrón que GridBoard/Top10Game: descarta respuestas de cargas
  // obsoletas (React Strict Mode monta el efecto dos veces en desarrollo).
  const cargaIdRef = useRef(0);

  useEffect(() => {
    cargarPartida();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dificultad]);

  const ganado = partida !== null && cadena.length > 0 && cadena[cadena.length - 1].jugador.nombre === partida.jugadorFinal.nombre;
  const terminada = ganado || rendido;
  // Mientras se juega, el jugador final todavía no está en `cadena` (se
  // añade solo al ganar, ver manejarSeleccion), así que todo lo que hay
  // después del inicial cuenta como intermedio. Al ganar, `cadena` ya
  // incluye el final, así que hay que descontarlo para no contarlo como
  // intermedio también.
  const jugadoresIntermedios = Math.max(cadena.length - (ganado ? 2 : 1), 0);
  const jugadoresIntermediosObjetivo = Math.max(partida ? partida.distanciaMinima - 1 : 0, 0);
  const nombresEnCadena = cadena.map((p) => p.jugador.nombre);

  async function cargarPartida() {
    const miCargaId = ++cargaIdRef.current;

    setCargando(true);
    setErrorCarga(null);
    setPartida(null);
    setCadena([]);
    setMensaje("");
    setTiempoFinal(null);
    setRendido(false);
    setPopupAbierto(false);
    setMostrandoCamino(false);
    setExperiencia(null);

    try {
      const res = await fetch(`/api/jugadores/enlazar/generar?dificultad=${dificultad}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo generar la partida.");
      }

      const nuevaPartida: PartidaGenerada = await res.json();
      if (miCargaId !== cargaIdRef.current) return;

      setPartida(nuevaPartida);
      setCadena([{ jugador: nuevaPartida.jugadorInicial }]);
      setHoraInicio(Date.now());
    } catch (err) {
      if (miCargaId !== cargaIdRef.current) return;
      setErrorCarga(err instanceof Error ? err.message : "No se pudo generar la partida.");
    } finally {
      if (miCargaId === cargaIdRef.current) setCargando(false);
    }
  }

  async function manejarSeleccion(jugador: Jugador) {
    if (!partida || terminada || verificando) return;

    if (nombresEnCadena.includes(jugador.nombre)) {
      setMensaje(`${jugador.nombre} ya está en la cadena.`);
      return;
    }

    setVerificando(true);
    setMensaje("");

    try {
      const ultimo = cadena[cadena.length - 1].jugador;
      const resultado = await verificarConexionApi(ultimo.nombre, jugador.nombre);

      if (!resultado.conectados) {
        setMensaje(`${ultimo.nombre} y ${jugador.nombre} no coincidieron nunca en un club.`);
        return;
      }

      const nuevoPaso: PasoCadena = {
        jugador: {
          nombre: jugador.nombre,
          nacionalidad: jugador.nacionalidad,
          imagenUrl: jugador.imagenUrl,
          // Pistas para el desplegable "Carrera" del eslabón (Opción B,
          // 12/08/2026): así el usuario puede consultar la carrera
          // completa del jugador que acaba de colocar y decidir si le
          // conviene revertirlo, sin tener que buscarlo otra vez.
          pistas: pistasDeEquipos(jugador.equipos),
        },
        conexion: { equipo: resultado.equipoComun!, temporada: resultado.temporada! },
      };
      let nuevaCadena = [...cadena, nuevoPaso];

      // Si el jugador añadido ES el final (el usuario lo buscó y lo puso
      // él mismo), la partida ya está ganada con este paso.
      let gano = jugador.nombre === partida.jugadorFinal.nombre;

      // Petición del usuario (11/08/2026): "hay que obviar el último
      // paso... esa comprobación tiene que ser automática" -- ya no hace
      // falta que busque y seleccione al jugador final a mano. Tras cada
      // jugador intermedio válido, se comprueba solo si YA conecta
      // directamente con el final; si es así, se añade el final a la
      // cadena automáticamente y se cierra la partida.
      if (!gano) {
        const resultadoFinal = await verificarConexionApi(jugador.nombre, partida.jugadorFinal.nombre);
        if (resultadoFinal.conectados) {
          nuevaCadena = [
            ...nuevaCadena,
            {
              jugador: partida.jugadorFinal,
              conexion: { equipo: resultadoFinal.equipoComun!, temporada: resultadoFinal.temporada! },
            },
          ];
          gano = true;
        }
      }

      setCadena(nuevaCadena);
      setMensaje("");

      if (gano) {
        const segundos = segundosTranscurridos(horaInicio);
        setTiempoFinal(segundos);
        setPopupAbierto(true);
        registrarPartida("LINKPLAYERS", dificultad, "victoria", segundos).then(setExperiencia);
      }
    } catch {
      setMensaje("No se pudo comprobar la conexión. Inténtalo de nuevo.");
    } finally {
      setVerificando(false);
    }
  }

  function revertirStep() {
    if (cadena.length <= 1 || terminada) return;
    setCadena((actual) => actual.slice(0, -1));
    setMensaje("");
  }

  function handleRendirse() {
    setMensaje("");
    setTiempoFinal(segundosTranscurridos(horaInicio));
    registrarPartida("LINKPLAYERS", dificultad, "derrota");
    setRendido(true);
    setPopupAbierto(true);
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-muted-foreground">Buscando dos jugadores para conectar...</p>
      </div>
    );
  }

  if (errorCarga || !partida) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-destructive">{errorCarga ?? "No se pudo cargar la partida."}</p>
        <GameButton onClick={cargarPartida}>Reintentar</GameButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 p-3 sm:gap-6 sm:p-6">
      {/* Cabeceras compactas -- caben en fila incluso en móvil (12/08/2026,
          mockup elegido por el usuario), cada una con su propio botón
          "Carrera" independiente que despliega sus etapas debajo, a todo
          el ancho (ver TarjetasObjetivo). */}
      <div className="w-full max-w-2xl">
        <TarjetasObjetivo jugadorInicial={partida.jugadorInicial} jugadorFinal={partida.jugadorFinal} />
      </div>

      <ul className="flex w-full max-w-md flex-col gap-2">
        {cadena.map((paso, i) => (
          <EslabonCadena key={`${paso.jugador.nombre}-${i}`} paso={paso} esFinal={i === cadena.length - 1 && ganado} />
        ))}
      </ul>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <PlayerSearch
          onSearch={buscarJugadores}
          excludeNames={nombresEnCadena}
          excludedLabel="Ya en la cadena"
          onSelect={manejarSeleccion}
          placeholder="Escribe el siguiente jugador..."
          disabled={terminada || verificando}
        />
        <div className="flex gap-2">
          <GameButton
            variant="secondary"
            onClick={revertirStep}
            disabled={cadena.length <= 1 || terminada}
            className="flex flex-1 items-center justify-center gap-1.5"
          >
            <UndoIcon className="h-4 w-4" />
            Revertir jugador
          </GameButton>
          <GameButton
            variant="destructive"
            onClick={() => setConfirmandoRendicion(true)}
            disabled={terminada}
            className="flex-1"
          >
            Rendirse
          </GameButton>
        </div>
      </div>

      {/* "Nueva partida" (12/08/2026, petición del usuario): el diálogo de
          confirmación ("se perderá el progreso") solo tiene sentido con
          la partida todavía en marcha -- terminada (ganada o rendida) ya
          no hay progreso que perder, las estadísticas ya han contado esta
          partida, así que se salta directo a cargarPartida() sin
          preguntar. */}
      <GameButton
        variant="secondary"
        onClick={() => (terminada ? cargarPartida() : setConfirmandoNuevaPartida(true))}
      >
        Nueva partida
      </GameButton>

      {mensaje && !terminada && <p className="max-w-xs text-center text-sm text-muted-foreground">{mensaje}</p>}

      <ConfirmDialog
        open={confirmandoNuevaPartida}
        onOpenChange={setConfirmandoNuevaPartida}
        titulo="¿Empezar una nueva partida?"
        descripcion="Se sortearán dos jugadores nuevos y perderás el progreso de la cadena actual."
        textoConfirmar="Sí, empezar de nuevo"
        onConfirmar={cargarPartida}
      />

      <ConfirmDialog
        open={confirmandoRendicion}
        onOpenChange={setConfirmandoRendicion}
        titulo="¿Rendirte?"
        descripcion="Se contará como derrota y no ganarás experiencia de esta partida."
        textoConfirmar="Sí, rendirme"
        onConfirmar={handleRendirse}
      />

      {terminada && (
        <GameResultDialog
          open={popupAbierto}
          onOpenChange={setPopupAbierto}
          resultado={ganado ? "exito" : "fracaso"}
          titulo={ganado ? "CADENA COMPLETADA" : "PARTIDA ABANDONADA"}
          descripcion={
            ganado ? (
              <>
                Llegaste de <span className="font-semibold text-foreground">{partida.jugadorInicial.nombre}</span> a{" "}
                <span className="font-semibold text-foreground">{partida.jugadorFinal.nombre}</span> con{" "}
                <span className="font-semibold text-foreground">{jugadoresIntermedios}</span>{" "}
                {etiquetaJugadoresIntermedios(jugadoresIntermedios)} en{" "}
                <span className="font-semibold text-foreground">{tiempoFinal}</span> segundos.
                {jugadoresIntermedios === jugadoresIntermediosObjetivo ? (
                  <> ¡El camino más corto posible!</>
                ) : (
                  <>
                    {" "}
                    El camino más corto era de {jugadoresIntermediosObjetivo}{" "}
                    {etiquetaJugadoresIntermedios(jugadoresIntermediosObjetivo)}.
                  </>
                )}
              </>
            ) : (
              <>
                Te has rendido con <span className="font-semibold text-foreground">{jugadoresIntermedios}</span>{" "}
                {etiquetaJugadoresIntermedios(jugadoresIntermedios)} colocados. El camino más corto era de{" "}
                <span className="font-semibold text-foreground">{jugadoresIntermediosObjetivo}</span>{" "}
                {etiquetaJugadoresIntermedios(jugadoresIntermediosObjetivo)}.
              </>
            )
          }
          onJugarDeNuevo={cargarPartida}
          experiencia={experiencia}
          respuestasCorrectas={{
            mostrando: mostrandoCamino,
            onToggle: () => setMostrandoCamino((actual) => !actual),
            contenido: <CaminoSolucion camino={partida.caminoSolucion} />,
          }}
        />
      )}
    </div>
  );
}
