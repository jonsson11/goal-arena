"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { ConfirmDialog } from "@/features/games/shared/ConfirmDialog";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import { ExperienciaGanada } from "@/features/games/shared/ExperienciaGanada";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import { CasillaGrid, EncabezadoCondicion } from "@/features/games/grid/GridCasillas";
import { celdasValidasParaJugador } from "@/features/games/grid/logic";
import {
  contarSolucionesTodasLasCeldas,
  TextoRespuestasCorrectas,
  type ResultadoCelda,
} from "@/features/games/grid/respuestasCorrectas";
import type { Tablero, Celda } from "@/features/games/grid/type";
import type { Jugador } from "@/features/games/shared/types";
import type { EstadoPartida } from "@/features/multijugador/type";

const INTERVALO_POLLING_PARTIDA_MS = 1500;
const INTERVALO_POLLING_SALA_MS = 2000; // tras acabar, esperando revancha del anfitrión

const ETIQUETA_DIFICULTAD: Record<string, string> = { facil: "Fácil", medio: "Medio", dificil: "Difícil" };

async function buscarJugadores(query: string): Promise<Jugador[]> {
  const res = await fetch(`/api/jugadores/buscar?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Error al buscar jugadores");
  return res.json();
}

/** Reconstruye un `Tablero` (mismo tipo que el modo individual) a partir
 * del estado de partida del servidor -- así el tablero de multijugador
 * puede reutilizar tal cual CasillaGrid/EncabezadoCondicion y la función
 * de validación celdasValidasParaJugador, sin duplicar nada de eso. Solo
 * tiene sentido cuando `partida.juego === "GRID"`. */
function construirTablero(partida: Extract<EstadoPartida, { juego: "GRID" }>): Tablero {
  const celdas: Celda[] = [];
  for (let fila = 0; fila < 3; fila++) {
    for (let columna = 0; columna < 3; columna++) {
      const colocacion = partida.miProgreso.find((c) => c.fila === fila && c.columna === columna);
      celdas.push({ fila, columna, jugador: colocacion ? colocacion.jugador : null });
    }
  }
  return { condicionesFila: partida.condicionesFila, condicionesColumna: partida.condicionesColumna, celdas };
}

function formatoTiempo(segundos: number): string {
  const s = Math.max(0, Math.round(segundos));
  const min = Math.floor(s / 60);
  const seg = s % 60;
  return `${min}:${seg.toString().padStart(2, "0")}`;
}

// Ficha compacta de rival: foto + nombre + aciertos, sin barra de
// progreso -- con hasta 7 rivales (sala de 8) es la diferencia entre una
// rejilla de 2-3 columnas que cabe en la pantalla y una lista vertical
// que obliga a bajar mucho. El check verde sustituye al número cuando ya
// ha completado el reto. `objetivo` (9 en GRID, 10 en TOP10) viene del
// propio servidor -- ver EstadoPartida.objetivo.
function FichaRival({
  objetivo,
  ...rival
}: EstadoPartida["rivales"][number] & { objetivo: number }) {
  const { nombre, avatar, avatarTipo, celdasResueltas, completado, resultado } = rival;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-2.5 py-2 backdrop-blur-md">
      <div className="relative shrink-0">
        {avatarTipo === "foto" ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar de otro usuario, URL de Supabase Storage
          <img src={avatar} alt={nombre} className="h-8 w-8 rounded-full border border-border object-cover" />
        ) : (
          <div className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-background text-sm">
            {avatar}
          </div>
        )}
        {completado && !resultado && (
          <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
            ✓
          </span>
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{nombre}</p>
        <p className="text-[11px] font-bold text-muted-foreground">
          {resultado
            ? resultado === "VICTORIA"
              ? "🏆 Ganó"
              : resultado === "EMPATE"
                ? "🤝 Empate"
                : "—"
            : `${celdasResueltas}/${objetivo} aciertos`}
        </p>
      </div>
    </div>
  );
}

// Tablero del Top10 Online: rejilla de 10 posiciones (mismo orden visual
// -- 1-5 en la columna izquierda, 6-10 en la derecha -- que el modo
// individual, ver Top10Game.tsx), pero SIN el ranking completo: solo se
// conoce el nombre real de una posición cuando aparece en `miProgreso`
// (ver comentario de seguridad en EstadoPartidaTop10). Versión más
// sencilla que la del modo individual (sin abreviar nombre por
// ResizeObserver ni colores oro/plata/bronce) -- aquí lo urgente es que
// funcione igual de bien en partida real, no replicar cada detalle visual
// del solitario.
function TableroTop10Online({
  totalPosiciones,
  miProgreso,
}: {
  totalPosiciones: number;
  miProgreso: Extract<EstadoPartida, { juego: "TOP10" }>["miProgreso"];
}) {
  const porPosicion = new Map(miProgreso.map((a) => [a.posicion, a.entrada]));

  return (
    <div
      className="grid w-full grid-cols-2 grid-flow-col gap-1.5 sm:gap-3"
      style={{ gridTemplateRows: `repeat(${Math.ceil(totalPosiciones / 2)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: totalPosiciones }, (_, i) => i + 1).map((posicion) => {
        const entrada = porPosicion.get(posicion);
        const codigoPais = entrada ? obtenerCodigoPais(entrada.nacionalidad) : null;

        return (
          <div
            key={posicion}
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 transition-all duration-300 sm:rounded-xl sm:px-4 sm:py-3 ${
              entrada
                ? "animate-in zoom-in-95 fade-in border-primary bg-primary/10 shadow-[0_0_18px_-6px_rgba(74,222,154,0.6)] duration-300"
                : "border-border bg-card"
            }`}
          >
            <span
              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[10px] font-bold sm:h-7 sm:w-7 sm:text-sm ${
                entrada ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }`}
            >
              {posicion}
            </span>
            <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
              {entrada ? (
                <>
                  <span className="truncate text-left text-[11px] font-semibold text-primary sm:text-base">
                    {entrada.nombre}
                  </span>
                  <span className="truncate text-left text-[9px] font-medium text-primary/80 sm:text-sm">
                    {entrada.valorTexto ?? entrada.valor}
                  </span>
                </>
              ) : (
                <span className="truncate text-left text-[11px] font-semibold text-muted-foreground sm:text-base">
                  ???
                </span>
              )}
            </div>
            {entrada &&
              (codigoPais ? (
                <span className={`fi fi-${codigoPais} h-3 w-4 shrink-0 rounded-sm sm:h-5 sm:w-7`} />
              ) : (
                // Nacionalidad sin bandera mapeada todavía (ver banderas.ts) --
                // en vez de dejar el hueco en blanco (parecía "no ha
                // cargado"), un indicador mínimo para que quede claro que
                // ahí falta ampliar el mapa, no que algo se ha roto.
                <span className="flex h-3 w-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[7px] font-bold text-muted-foreground sm:h-5 sm:w-7 sm:text-[9px]">
                  {entrada.nacionalidad.slice(0, 2).toUpperCase()}
                </span>
              ))}
          </div>
        );
      })}
    </div>
  );
}

export default function PartidaMultijugadorPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const { usuario, refrescarUsuario } = useAuth();
  const router = useRouter();

  const [partida, setPartida] = useState<EstadoPartida | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [celdasPendientes, setCeldasPendientes] = useState<Celda[]>([]);
  const [jugadorPendiente, setJugadorPendiente] = useState<Jugador | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
  // Cuenta atrás 3-2-1 antes de que arranque el timer real -- 0 significa
  // "ya se puede jugar". Se recalcula en cada respuesta del servidor
  // contra `empezadaEn` (un reloj compartido), nunca es un cronómetro
  // propio del cliente -- ver comentario largo en /lib/salas.ts.
  const [segundosCuentaAtras, setSegundosCuentaAtras] = useState(0);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [pidiendoRevancha, setPidiendoRevancha] = useState(false);

  const activoRef = useRef(true);
  const estadoActualRef = useRef<string | null>(null);

  // Poll de la partida mientras está EN_CURSO. La función de consulta va
  // DENTRO del efecto (no como useCallback fuera) a propósito -- mismo
  // patrón que ya usa la sala de espera (SalaEsperaPage): así el lint de
  // "no llames a setState directamente dentro de un efecto" no se dispara,
  // porque la llamada inicial queda claramente ligada a la suscripción de
  // polling que el propio efecto está montando, no a un cálculo de estado
  // derivado de otro estado de React.
  useEffect(() => {
    if (!usuario) return;
    activoRef.current = true;

    async function consultar() {
      try {
        const res = await fetch(`/api/salas/${codigo}/partida`);
        const datos = await res.json();
        if (!activoRef.current) return;

        if (!res.ok) {
          setError(datos.error ?? "No se pudo cargar la partida.");
          setCargando(false);
          return;
        }

        const nueva = datos as EstadoPartida;
        // Justo al pasar a FINALIZADA (y solo esa vez): refresca el
        // nivel/XP del Header/AuthContext. Sin esto, como el EXP de
        // multijugador se aplica enteramente en el servidor (al cerrar la
        // partida, no cuando el cliente "avisa" de nada), la barra de
        // arriba se quedaba con el nivel/XP de antes de jugar hasta que
        // algo más (como pedir la revancha) forzaba una recarga.
        if (estadoActualRef.current !== "FINALIZADA" && nueva.estado === "FINALIZADA") {
          refrescarUsuario();
        }
        estadoActualRef.current = nueva.estado;
        setPartida(nueva);
        setCargando(false);

        const empezadaEnMs = new Date(nueva.empezadaEn).getTime();
        const msHastaEmpezar = empezadaEnMs - Date.now();
        setSegundosCuentaAtras(msHastaEmpezar > 0 ? Math.ceil(msHastaEmpezar / 1000) : 0);

        const segundosTranscurridos = Math.max(0, (Date.now() - empezadaEnMs) / 1000);
        setSegundosRestantes(Math.max(0, Math.min(nueva.duracionSegundos, nueva.duracionSegundos - segundosTranscurridos)));
      } catch {
        if (activoRef.current) setError("No se pudo conectar con el servidor.");
      }
    }

    consultar();
    const intervalo = setInterval(() => {
      if (estadoActualRef.current !== "FINALIZADA") consultar();
    }, INTERVALO_POLLING_PARTIDA_MS);

    return () => {
      activoRef.current = false;
      clearInterval(intervalo);
    };
    // refrescarUsuario se usa dentro de consultar() pero no se añade a las
    // dependencias a propósito: no está memoizada (referencia nueva en
    // cada render de AuthProvider), así que incluirla recrearía el
    // intervalo de polling en cada refresco -- justo lo que este efecto
    // evita usando la función local `consultar` en vez de un useCallback
    // externo (mismo criterio que ya se explica arriba).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, usuario]);

  // Tic local cada segundo -- adelanta tanto la cuenta atrás 3-2-1 como el
  // timer real de la ronda, y se corrige solo con cada respuesta fresca
  // del servidor (arriba). Un único efecto para los dos relojes, no dos
  // por separado.
  useEffect(() => {
    if (partida?.estado !== "EN_CURSO") return;
    const tic = setInterval(() => {
      setSegundosCuentaAtras((s) => Math.max(0, s - 1));
      setSegundosRestantes((s) => Math.max(0, s - 1));
    }, 1000);
    return () => clearInterval(tic);
  }, [partida?.estado]);

  const esCreador = usuario && partida ? !partida.rivales.some((r) => r.esCreador) : false;

  // Tras FINALIZADA: si no soy el creador, vigilo /api/salas/[codigo] (el
  // mismo endpoint de la sala de espera) por si el anfitrión pide
  // revancha (vuelve a ESPERANDO) -- entonces me lleva solo a la sala de
  // espera, sin que tenga que hacer nada.
  useEffect(() => {
    if (partida?.estado !== "FINALIZADA" || !usuario || esCreador) return;

    const intervalo = setInterval(async () => {
      try {
        const res = await fetch(`/api/salas/${codigo}`);
        if (res.status === 404) {
          clearInterval(intervalo);
          return;
        }
        const datos = await res.json();
        if (res.ok && datos.estado === "ESPERANDO") {
          clearInterval(intervalo);
          router.replace(`/multijugador/sala/${codigo}`);
        }
      } catch {
        // reintenta en el siguiente tick
      }
    }, INTERVALO_POLLING_SALA_MS);

    return () => clearInterval(intervalo);
  }, [partida?.estado, codigo, usuario, router, esCreador]);

  if (!usuario) {
    return (
      <AuthGate
        icono="🎮"
        titulo="Juega con tus amigos"
        descripcion="Inicia sesión para entrar en esta partida."
        redirectTras={`/multijugador/sala/${codigo}/partida`}
        aspectos={["🎮 Salas de 2 a 8", "⏱️ Mismo reto, en directo"]}
      />
    );
  }

  async function colocarJugador(jugador: Jugador, celda: Celda) {
    setMensaje("");
    try {
      const res = await fetch(`/api/salas/${codigo}/colocar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fila: celda.fila, columna: celda.columna, jugador }),
      });
      const datos = await res.json();
      setCeldasPendientes([]);
      setJugadorPendiente(null);
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo colocar ese jugador.");
        return;
      }
      const nueva = datos as EstadoPartida;
      if (estadoActualRef.current !== "FINALIZADA" && nueva.estado === "FINALIZADA") {
        refrescarUsuario();
      }
      estadoActualRef.current = nueva.estado;
      setPartida(nueva);
    } catch {
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  function procesarSeleccion(jugador: Jugador) {
    if (!partida || partida.juego !== "GRID" || partida.estado !== "EN_CURSO" || segundosCuentaAtras > 0) return;
    const tablero = construirTablero(partida);
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

  // Equivalente a colocarJugador/procesarSeleccion pero para TOP10 -- no
  // hace falta elegir casilla (el servidor decide la posición según el
  // ranking, que el cliente no conoce entero), así que es un único paso:
  // se manda el jugador y se pinta lo que responda el servidor.
  async function acertarJugador(jugador: Jugador) {
    setMensaje("");
    try {
      const res = await fetch(`/api/salas/${codigo}/acertar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jugador }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo comprobar ese jugador.");
        return;
      }
      const nueva = datos as EstadoPartida;
      if (estadoActualRef.current !== "FINALIZADA" && nueva.estado === "FINALIZADA") {
        refrescarUsuario();
      }
      estadoActualRef.current = nueva.estado;
      setPartida(nueva);
    } catch {
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  async function salir() {
    activoRef.current = false;
    await fetch(`/api/salas/${codigo}/salir`, { method: "POST" });
    router.push("/multijugador");
  }

  async function pedirRevancha() {
    setPidiendoRevancha(true);
    try {
      const res = await fetch(`/api/salas/${codigo}/revancha`, { method: "POST" });
      if (res.ok) router.replace(`/multijugador/sala/${codigo}`);
    } finally {
      setPidiendoRevancha(false);
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">Cargando partida...</p>
      </div>
    );
  }

  if (error && !partida) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <GameButton onClick={() => router.push(`/multijugador/sala/${codigo}`)}>Volver a la sala</GameButton>
      </div>
    );
  }

  if (!partida) return null;

  const finalizada = partida.estado === "FINALIZADA";
  const enCuentaAtras = !finalizada && segundosCuentaAtras > 0;

  return (
    <div className="px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
        {!finalizada && !enCuentaAtras && (
          <div className="flex w-full max-w-md items-center justify-between">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              {partida.juego === "GRID" ? (ETIQUETA_DIFICULTAD[partida.dificultad] ?? partida.dificultad) : "Top 10"}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-sm font-extrabold tabular-nums ${
                segundosRestantes <= 30
                  ? "animate-pulse border-destructive bg-destructive/10 text-destructive"
                  : "border-primary/40 bg-primary/10 text-primary"
              }`}
            >
              ⏱ {formatoTiempo(segundosRestantes)}
            </span>
          </div>
        )}

        {finalizada ? (
          <ResultadoPartida
            partida={partida}
            esCreador={esCreador}
            onPedirRevancha={pedirRevancha}
            onSalir={() => setConfirmandoSalida(true)}
            pidiendoRevancha={pidiendoRevancha}
          />
        ) : enCuentaAtras ? (
          // Cuenta atrás 3-2-1: el tablero/ranking ya está cargado (fetch
          // hecho, solo que no se pinta todavía) -- lo único que falta es
          // que llegue el instante `empezadaEn` compartido. key=segundosCuentaAtras
          // fuerza a React a remontar el número en cada tic, así se
          // dispara la animación de entrada en cada cambio.
          <div className="flex h-72 w-full flex-col items-center justify-center gap-3">
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Prepárate</span>
            <span
              key={segundosCuentaAtras}
              className="animate-in zoom-in-50 fade-in text-8xl font-extrabold text-primary duration-300"
            >
              {segundosCuentaAtras}
            </span>
          </div>
        ) : partida.juego === "GRID" ? (
          <SeccionGrid
            partida={partida}
            celdasPendientes={celdasPendientes}
            jugadorPendiente={jugadorPendiente}
            mensaje={mensaje}
            onColocar={colocarJugador}
            onSeleccionar={procesarSeleccion}
          />
        ) : (
          <SeccionTop10 partida={partida} mensaje={mensaje} onAcertar={acertarJugador} />
        )}

        <ConfirmDialog
          open={confirmandoSalida}
          onOpenChange={setConfirmandoSalida}
          titulo="¿Salir de la sala?"
          descripcion="Podrás volver a unirte más tarde con el mismo código, si la sala sigue abierta."
          textoConfirmar="Sí, salir"
          onConfirmar={salir}
        />
      </div>
    </div>
  );
}

// Tablero GRID en curso -- extraído a un componente propio (en vez de
// dejarlo inline en un ternario) para que TypeScript estreche `partida` al
// tipo GRID a través de las props, sin depender de un narrowing frágil
// dentro de un JSX condicional compuesto.
function SeccionGrid({
  partida,
  celdasPendientes,
  jugadorPendiente,
  mensaje,
  onColocar,
  onSeleccionar,
}: {
  partida: Extract<EstadoPartida, { juego: "GRID" }>;
  celdasPendientes: Celda[];
  jugadorPendiente: Jugador | null;
  mensaje: string;
  onColocar: (jugador: Jugador, celda: Celda) => void;
  onSeleccionar: (jugador: Jugador) => void;
}) {
  const tablero = construirTablero(partida);

  return (
    <div className="flex w-full flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      <div className="w-full max-w-md">
        <div className="grid w-full grid-cols-[minmax(0,0.7fr)_repeat(3,minmax(0,1fr))] gap-1.5 sm:gap-2">
          <div />
          {tablero.condicionesColumna.map((cond, i) => (
            <EncabezadoCondicion key={i} condicion={cond} />
          ))}

          {tablero.condicionesFila.map((condFila, fila) => (
            <div key={fila} className="contents">
              <EncabezadoCondicion condicion={condFila} />
              {[0, 1, 2].map((columna) => {
                const celda = tablero.celdas.find((c) => c.fila === fila && c.columna === columna)!;
                const esPendiente = celdasPendientes.some((c) => c.fila === fila && c.columna === columna);
                return (
                  <CasillaGrid
                    key={columna}
                    celda={celda}
                    esPendiente={esPendiente}
                    bloqueada={!esPendiente && celdasPendientes.length > 0}
                    onClick={() => {
                      if (esPendiente && jugadorPendiente) onColocar(jugadorPendiente, celda);
                    }}
                  />
                );
              })}
            </div>
          ))}
        </div>

        <div className="mt-6 flex w-full justify-center">
          <PlayerSearch
            onSearch={buscarJugadores}
            excludeNames={partida.miProgreso.map((c) => c.jugador.nombre)}
            onSelect={onSeleccionar}
            placeholder="Escribe un jugador..."
            disabled={celdasPendientes.length > 0}
          />
        </div>
        {mensaje && <p className="mt-3 text-center text-sm text-muted-foreground">{mensaje}</p>}

        {/* Rivales en móvil/tablet: rejilla compacta debajo del buscador
            (2-3 columnas), no una lista vertical -- con 7 rivales (sala de
            8) son 3-4 filas cortas en vez de 7 filas largas. En
            escritorio (lg:) se oculta aquí porque se muestra en la
            columna de al lado. */}
        {partida.rivales.length > 0 && (
          <div className="mt-6 grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
            {partida.rivales.map((rival) => (
              <FichaRival key={rival.id} objetivo={partida.objetivo} {...rival} />
            ))}
          </div>
        )}
      </div>

      {/* Misma rejilla de fichas, aquí en una sola columna pegada (sticky)
          junto al tablero -- solo visible en escritorio, donde sí sobra
          espacio a un lado. */}
      {partida.rivales.length > 0 && (
        <div className="hidden w-full max-w-xs flex-col gap-2 lg:sticky lg:top-6 lg:flex">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rivales</span>
          {partida.rivales.map((rival) => (
            <FichaRival key={rival.id} objetivo={partida.objetivo} {...rival} />
          ))}
        </div>
      )}
    </div>
  );
}

// Ranking TOP10 en curso -- mismo motivo que SeccionGrid: props tipadas al
// tipo TOP10 en vez de narrowing inline.
function SeccionTop10({
  partida,
  mensaje,
  onAcertar,
}: {
  partida: Extract<EstadoPartida, { juego: "TOP10" }>;
  mensaje: string;
  onAcertar: (jugador: Jugador) => void;
}) {
  return (
    <div className="flex w-full flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      <div className="w-full max-w-md">
        <h1 className="mb-4 text-center text-lg font-bold text-foreground sm:text-xl">{partida.titulo}</h1>

        <TableroTop10Online totalPosiciones={partida.objetivo} miProgreso={partida.miProgreso} />

        <div className="mt-6 flex w-full justify-center">
          <PlayerSearch
            onSearch={buscarJugadores}
            excludeNames={partida.miProgreso.map((a) => a.entrada.nombre)}
            excludedLabel="Ya acertado"
            onSelect={onAcertar}
            placeholder="Escribe un jugador..."
          />
        </div>
        {mensaje && <p className="mt-3 text-center text-sm text-muted-foreground">{mensaje}</p>}

        {partida.rivales.length > 0 && (
          <div className="mt-6 grid w-full grid-cols-2 gap-2 sm:grid-cols-3 lg:hidden">
            {partida.rivales.map((rival) => (
              <FichaRival key={rival.id} objetivo={partida.objetivo} {...rival} />
            ))}
          </div>
        )}
      </div>

      {partida.rivales.length > 0 && (
        <div className="hidden w-full max-w-xs flex-col gap-2 lg:sticky lg:top-6 lg:flex">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rivales</span>
          {partida.rivales.map((rival) => (
            <FichaRival key={rival.id} objetivo={partida.objetivo} {...rival} />
          ))}
        </div>
      )}
    </div>
  );
}

function ResultadoPartida({
  partida,
  esCreador,
  onPedirRevancha,
  onSalir,
  pidiendoRevancha,
}: {
  partida: EstadoPartida;
  esCreador: boolean;
  onPedirRevancha: () => void;
  onSalir: () => void;
  pidiendoRevancha: boolean;
}) {
  const { usuario } = useAuth();

  // Solo GRID tiene botón de "mostrar respuestas correctas" por ahora
  // (mismo mecanismo que el modo individual, ver GridBoard.tsx) -- TOP10
  // Online no lo tiene todavía.
  const [respuestasCorrectas, setRespuestasCorrectas] = useState<Record<string, ResultadoCelda> | null>(null);
  const [cargandoRespuestas, setCargandoRespuestas] = useState(false);
  const [mostrandoRespuestas, setMostrandoRespuestas] = useState(false);

  async function alternarRespuestasCorrectas() {
    if (partida.juego !== "GRID") return;
    if (mostrandoRespuestas) {
      setMostrandoRespuestas(false);
      return;
    }

    setMostrandoRespuestas(true);
    if (!respuestasCorrectas) {
      setCargandoRespuestas(true);
      const datos = await contarSolucionesTodasLasCeldas(construirTablero(partida));
      setRespuestasCorrectas(datos);
      setCargandoRespuestas(false);
    }
  }

  const titulo =
    partida.miResultado === "VICTORIA" ? "¡Has ganado!" : partida.miResultado === "EMPATE" ? "Empate" : "Has perdido";
  const colorTitulo =
    partida.miResultado === "VICTORIA"
      ? "text-primary"
      : partida.miResultado === "EMPATE"
        ? "text-secondary"
        : "text-destructive";

  const clasificacion = [
    {
      id: usuario?.id ?? "yo",
      nombre: usuario?.nombre ?? "Tú",
      celdasResueltas: partida.miProgreso.length,
      resultado: partida.miResultado,
      esYo: true,
    },
    ...partida.rivales.map((r) => ({
      id: r.id,
      nombre: r.nombre,
      celdasResueltas: r.celdasResueltas,
      resultado: r.resultado,
      esYo: false,
    })),
  ].sort((a, b) => b.celdasResueltas - a.celdasResueltas);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 py-6 text-center">
      <div>
        <h1 className={`text-3xl font-extrabold tracking-tight ${colorTitulo}`}>{titulo}</h1>
        <p className="mt-1 text-sm text-muted-foreground">La partida ha terminado.</p>
      </div>

      {/* Mismo componente que anima la barra de nivel en el modo
          individual (GameResultDialog) -- se le pasa el mismo tipo
          RespuestaPartida que ya calcula el servidor al cerrar la
          partida, así que la animación (barra llenándose, destello si
          subes de nivel...) sale gratis, sin reinventarla aquí. */}
      <ExperienciaGanada respuesta={partida.miExperiencia} />

      {/* Misma clasificación de siempre, pero como un único panel de
          cristal con separadores -- mismo criterio que la lista de
          rivales de arriba y la de jugadores de la sala de espera. */}
      <div className="w-full divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md">
        {clasificacion.map((jugador, i) => (
          <div
            key={jugador.id}
            className={`flex items-center justify-between px-4 py-3 ${jugador.esYo ? "bg-primary/10" : ""}`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
              <span className="text-sm font-semibold text-foreground">
                {jugador.nombre}
                {jugador.esYo && " (tú)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {jugador.celdasResueltas}/{partida.objetivo}
              </span>
              {jugador.resultado === "VICTORIA" && <span>🏆</span>}
              {jugador.resultado === "EMPATE" && <span>🤝</span>}
            </div>
          </div>
        ))}
      </div>

      {partida.juego === "GRID" && (
        <div className="flex w-full flex-col items-center gap-2">
          <GameButton
            variant="secondary"
            onClick={alternarRespuestasCorrectas}
            className="flex w-full items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
          >
            {mostrandoRespuestas ? (
              <>
                <EyeOff className="h-4 w-4" /> Ocultar respuestas correctas
              </>
            ) : (
              <>
                <Eye className="h-4 w-4" /> Mostrar respuestas correctas
              </>
            )}
          </GameButton>
          {mostrandoRespuestas && (
            <TextoRespuestasCorrectas
              tablero={construirTablero(partida)}
              datos={respuestasCorrectas}
              cargando={cargandoRespuestas}
            />
          )}
        </div>
      )}

      <div className="flex w-full flex-col gap-3">
        {esCreador ? (
          <GameButton onClick={onPedirRevancha} disabled={pidiendoRevancha} className="w-full py-3">
            {pidiendoRevancha ? "Preparando revancha..." : "Volver a la sala de espera"}
          </GameButton>
        ) : (
          <p className="text-xs text-muted-foreground">Esperando a que el anfitrión decida qué hacer...</p>
        )}
        <GameButton variant="destructive" onClick={onSalir} className="w-full">
          Salir
        </GameButton>
      </div>
    </div>
  );
}
