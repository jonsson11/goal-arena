"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { ConfirmDialog } from "@/features/games/shared/ConfirmDialog";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import { CasillaGrid, EncabezadoCondicion } from "@/features/games/grid/GridCasillas";
import { celdasValidasParaJugador } from "@/features/games/grid/logic";
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
 * de validación celdasValidasParaJugador, sin duplicar nada de eso. */
function construirTablero(partida: EstadoPartida): Tablero {
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

function BarraProgresoRival({
  nombre,
  avatar,
  avatarTipo,
  celdasResueltas,
  completado,
  resultado,
}: EstadoPartida["rivales"][number]) {
  const pct = Math.min(100, (celdasResueltas / 9) * 100);
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-border bg-card px-3 py-2.5">
      {avatarTipo === "foto" ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar de otro usuario, URL de Supabase Storage
        <img src={avatar} alt={nombre} className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-base">
          {avatar}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="mb-1 flex items-center justify-between gap-2">
          <span className="truncate text-xs font-semibold text-foreground">{nombre}</span>
          <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
            {resultado
              ? resultado === "VICTORIA"
                ? "🏆"
                : resultado === "EMPATE"
                  ? "🤝"
                  : ""
              : `${celdasResueltas}/9`}
          </span>
        </div>
        {/* Barra con transición de ancho -- es la animación "sutil" del
            acierto: cada vez que celdasResueltas sube, el ancho crece con
            transition-all en vez de saltar de golpe. Nada de confeti ni
            popups por cada acierto de un rival. */}
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className={`h-full rounded-full transition-all duration-500 ${completado ? "bg-primary" : "bg-secondary"}`}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function PartidaMultijugadorPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const { usuario } = useAuth();
  const router = useRouter();

  const [partida, setPartida] = useState<EstadoPartida | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [celdasPendientes, setCeldasPendientes] = useState<Celda[]>([]);
  const [jugadorPendiente, setJugadorPendiente] = useState<Jugador | null>(null);
  const [segundosRestantes, setSegundosRestantes] = useState(0);
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
        estadoActualRef.current = nueva.estado;
        setPartida(nueva);
        setCargando(false);

        const empezadaEnMs = new Date(nueva.empezadaEn).getTime();
        const restante = nueva.duracionSegundos - (Date.now() - empezadaEnMs) / 1000;
        setSegundosRestantes(Math.max(0, restante));
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
  }, [codigo, usuario]);

  // Cuenta atrás local, tic cada segundo -- se corrige solo con cada
  // respuesta fresca del servidor (arriba), nunca es la fuente de verdad.
  useEffect(() => {
    if (partida?.estado !== "EN_CURSO") return;
    const tic = setInterval(() => setSegundosRestantes((s) => Math.max(0, s - 1)), 1000);
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
      estadoActualRef.current = (datos as EstadoPartida).estado;
      setPartida(datos as EstadoPartida);
    } catch {
      setMensaje("No se pudo conectar con el servidor.");
    }
  }

  function procesarSeleccion(jugador: Jugador) {
    if (!partida || partida.estado !== "EN_CURSO") return;
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

  const tablero = construirTablero(partida);
  const finalizada = partida.estado === "FINALIZADA";

  return (
    <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-4 py-6 sm:px-6">
      {!finalizada && (
        <div className="flex w-full max-w-md items-center justify-between">
          <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
            {ETIQUETA_DIFICULTAD[partida.dificultad ?? ""] ?? partida.dificultad}
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
      ) : (
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
                          if (esPendiente && jugadorPendiente) colocarJugador(jugadorPendiente, celda);
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
                onSelect={procesarSeleccion}
                placeholder="Escribe un jugador..."
                disabled={celdasPendientes.length > 0}
              />
            </div>
            {mensaje && <p className="mt-3 text-center text-sm text-muted-foreground">{mensaje}</p>}
          </div>

          <div className="flex w-full max-w-xs flex-col gap-2 lg:sticky lg:top-6">
            <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Rivales</span>
            {partida.rivales.map((rival) => (
              <BarraProgresoRival key={rival.id} {...rival} />
            ))}
          </div>
        </div>
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

      <div className="flex w-full flex-col gap-2">
        {clasificacion.map((jugador, i) => (
          <div
            key={jugador.id}
            className={`flex items-center justify-between rounded-xl border px-4 py-2.5 ${
              jugador.esYo ? "border-primary/40 bg-primary/10" : "border-border bg-card"
            }`}
          >
            <div className="flex items-center gap-2.5">
              <span className="text-xs font-bold text-muted-foreground">#{i + 1}</span>
              <span className="text-sm font-semibold text-foreground">
                {jugador.nombre}
                {jugador.esYo && " (tú)"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{jugador.celdasResueltas}/9</span>
              {jugador.resultado === "VICTORIA" && <span>🏆</span>}
              {jugador.resultado === "EMPATE" && <span>🤝</span>}
            </div>
          </div>
        ))}
      </div>

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