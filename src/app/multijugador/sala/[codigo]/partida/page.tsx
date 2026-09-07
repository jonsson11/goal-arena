"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { ConfirmDialog } from "@/features/games/shared/ConfirmDialog";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import { ExperienciaGanada } from "@/features/games/shared/ExperienciaGanada";
import { CambioTrofeos } from "@/features/ranked/CambioTrofeos";
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
import { TarjetasObjetivo, EslabonCadena } from "@/features/games/linkplayers/LinkPlayersGame";

const INTERVALO_POLLING_PARTIDA_MS = 1500;
const INTERVALO_POLLING_SALA_MS = 2000; // tras acabar, esperando revancha del anfitrión

// Duración de la cuenta atrás 3-2-1, en segundos -- DEBE coincidir con
// SEGUNDOS_CUENTA_ATRAS de src/lib/salas.ts. No se puede importar esa
// constante aquí (salas.ts es "SOLO SERVIDOR", tira de Prisma) así que se
// repite como constante local; si se cambia allí, cambiar también aquí.
// (La duración de la revelación "cara a cara" que precede al 3-2-1,
// SEGUNDOS_REVELACION_RIVAL en salas.ts, no hace falta repetirla aquí --
// el cliente solo necesita saber "¿faltan más de SEGUNDOS_CUENTA_ATRAS
// para empezadaEn?" para decidir qué fase pintar, no la duración total.)
const SEGUNDOS_CUENTA_ATRAS = 3;

const ETIQUETA_DIFICULTAD: Record<string, string> = { facil: "Fácil", medio: "Medio", dificil: "Difícil" };

// LinkPlayers habla en "jugadores intermedios", no en Fácil/Medio/Difícil
// (mismo criterio que /jugar/linkplayers y /multijugador/crear, ver
// comentarios ahí) -- (12/08/2026, Entrega 2).
const ETIQUETA_DIFICULTAD_LINKPLAYERS: Record<string, string> = { facil: "1-2", medio: "3-4", dificil: "5-7" };

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
  const { nombre, avatar, avatarTipo, celdasResueltas, resultado } = rival;
  // Progreso en directo (07/09/2026, opción A elegida tras comparar
  // mockups): antes era solo texto pequeño en gris ("3/9 aciertos"), poco
  // perceptible de un vistazo. Ahora una barra fina bajo el nombre (dorada
  // + resplandor a partir del 75%, mismo criterio de "ya casi" que el
  // resto de la app) y el número en grande y en verde, el color de marca.
  const pct = Math.min(100, Math.round((celdasResueltas / objetivo) * 100));
  const cerca = celdasResueltas / objetivo >= 0.75;
  return (
    <div className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/40 px-2.5 py-2 backdrop-blur-md">
      {avatarTipo === "foto" ? (
        // eslint-disable-next-line @next/next/no-img-element -- avatar de otro usuario, URL de Supabase Storage
        <img src={avatar} alt={nombre} className="h-8 w-8 shrink-0 rounded-full border border-border object-cover" />
      ) : (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border bg-background text-sm">
          {avatar}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <p className="truncate text-xs font-semibold text-foreground">{nombre}</p>
        {resultado ? (
          <p className="text-[11px] font-bold text-muted-foreground">
            {resultado === "VICTORIA" ? "🏆 Ganó" : resultado === "EMPATE" ? "🤝 Empate" : "—"}
          </p>
        ) : (
          <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className={`h-full rounded-full transition-[width] duration-500 ${
                cerca ? "bg-[#D4AF37] shadow-[0_0_8px_rgba(212,175,55,0.6)]" : "bg-primary"
              }`}
              style={{ width: `${pct}%` }}
            />
          </div>
        )}
      </div>
      {!resultado && (
        <span className="shrink-0 text-lg font-extrabold tabular-nums text-primary">
          {celdasResueltas}
          <span className="text-xs font-semibold text-muted-foreground">/{objetivo}</span>
        </span>
      )}
    </div>
  );
}

type JugadorEnfrentamiento = {
  id: string;
  nombre: string;
  avatar: string;
  avatarTipo: "emoji" | "foto";
  nivel: number;
  esYo: boolean;
};

function AvatarJugadorPartida({
  jugador,
  tamano = "h-9 w-9 text-lg",
}: {
  jugador: JugadorEnfrentamiento;
  tamano?: string;
}) {
  const borde = jugador.esYo ? "border-primary" : "border-border";
  return jugador.avatarTipo === "foto" ? (
    // eslint-disable-next-line @next/next/no-img-element -- avatar de usuario, URL de Supabase Storage
    <img
      src={jugador.avatar}
      alt={jugador.nombre}
      className={`shrink-0 rounded-full border object-cover ${borde} ${tamano}`}
    />
  ) : (
    <div className={`flex shrink-0 items-center justify-center rounded-full border bg-background ${borde} ${tamano}`}>
      {jugador.avatar}
    </div>
  );
}

// Revelación "cara a cara" antes de la cuenta atrás -- fase nueva
// (07/09/2026), pintada mientras `ahora` está a MÁS de SEGUNDOS_CUENTA_ATRAS
// de `empezadaEn` (ver el cálculo de `enRevelacion` más abajo). Con
// exactamente 2 jugadores (el caso normal, tanto en ranked como en una
// sala privada 1vs1) es el "cara a cara" de verdad: avatares entrando
// desde los lados con un destello al llegar al centro. Con más de 2 (sala
// privada de grupo) no hay "rival" singular al que enfrentar, así que cae
// a una versión más simple -- fila de avatares entrando con un pequeño
// escalonado, sin VS ni destello.
function RevelacionRivalPartida({ jugadores }: { jugadores: JugadorEnfrentamiento[] }) {
  const esUnoContraUno = jugadores.length === 2;

  return (
    <div className="relative flex h-80 w-full flex-col items-center justify-center gap-6">
      <Image src="/LOGO ARENA-SinLetra.png" alt="" width={44} height={44} className="absolute top-0" />

      <span className="text-shimmer bg-gradient-to-r from-primary via-[#7ef2bd] to-secondary bg-clip-text text-sm font-extrabold uppercase tracking-[0.2em] text-transparent">
        {esUnoContraUno ? "¡Rival encontrado!" : "Todos preparados"}
      </span>

      {esUnoContraUno ? (
        <div className="relative flex w-full max-w-sm items-center justify-center gap-4">
          <span
            aria-hidden
            className="revelacion-destello absolute h-32 w-32 rounded-full bg-primary/50 blur-2xl"
          />
          <div className="revelacion-desliza-izq relative z-10 flex w-28 flex-col items-center gap-2">
            <AvatarJugadorPartida jugador={jugadores[0]} tamano="h-16 w-16 text-3xl" />
            <p className="w-full truncate text-center text-sm font-extrabold text-foreground">{jugadores[0].nombre}</p>
            <span className="text-[11px] font-extrabold text-[#D4AF37]">★ Nv. {jugadores[0].nivel}</span>
          </div>
          <span className="relative z-10 text-3xl font-extrabold text-[#D4AF37]">VS</span>
          <div className="revelacion-desliza-der relative z-10 flex w-28 flex-col items-center gap-2">
            <AvatarJugadorPartida jugador={jugadores[1]} tamano="h-16 w-16 text-3xl" />
            <p className="w-full truncate text-center text-sm font-extrabold text-foreground">{jugadores[1].nombre}</p>
            <span className="text-[11px] font-extrabold text-[#D4AF37]">★ Nv. {jugadores[1].nivel}</span>
          </div>
        </div>
      ) : (
        <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-4">
          {jugadores.map((j, i) => (
            <div
              key={j.id}
              className="revelacion-desliza-izq flex flex-col items-center gap-1.5"
              style={{ animationDelay: `${i * 80}ms` }}
            >
              <AvatarJugadorPartida jugador={j} tamano="h-12 w-12 text-xl" />
              <p className="max-w-16 truncate text-[11px] font-semibold text-muted-foreground">
                {j.esYo ? "Tú" : j.nombre}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Cuenta atrás 3-2-1 antes de que arranque la ronda -- misma pantalla para
// salas privadas y ranked (07/09/2026, mockup aprobado "Opción A: halo
// central"). El aro (SVG) y el halo que respira viven en el MISMO
// contenedor de 190x190px, ambos centrados dentro de él -- el aro por
// tamaño exacto (`inset-0`, mide justo 190x190) y el halo por posición
// absoluta al 50%/50% + `-translate-x/y-1/2` (168x168, centrado sobre el
// punto medio del contenedor). Así quedan siempre concéntricos de verdad,
// en vez de depender de que flexbox coloque bien un hijo `absolute` suelto
// entre hermanos de tamaño distinto -- que es justo el desajuste que se
// veía en el primer mockup HTML.
function CuentaAtrasPartida({
  segundos,
  fraccionRestante,
  jugadores,
}: {
  segundos: number;
  fraccionRestante: number;
  jugadores: JugadorEnfrentamiento[];
}) {
  const RADIO = 88;
  const CIRCUNFERENCIA = 2 * Math.PI * RADIO;
  const offset = CIRCUNFERENCIA * (1 - fraccionRestante);
  const esUnoContraUno = jugadores.length === 2;

  return (
    <div className="relative flex h-80 w-full flex-col items-center justify-center gap-4">
      <Image src="/LOGO ARENA-SinLetra.png" alt="" width={44} height={44} className="absolute top-0" />

      <div className="relative flex h-[190px] w-[190px] shrink-0 items-center justify-center">
        <svg viewBox="0 0 190 190" className="absolute inset-0 -rotate-90">
          <circle cx="95" cy="95" r={RADIO} fill="none" strokeWidth="3" className="stroke-white/10" />
          <circle
            cx="95"
            cy="95"
            r={RADIO}
            fill="none"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={CIRCUNFERENCIA}
            strokeDashoffset={offset}
            className="stroke-primary transition-[stroke-dashoffset] duration-200 ease-linear"
          />
        </svg>
        <div className="launcher-halo-pulso absolute left-1/2 top-1/2 flex h-[168px] w-[168px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-primary/35">
          <span
            key={segundos}
            className="animate-in zoom-in-50 fade-in bg-gradient-to-r from-primary via-[#7ef2bd] to-secondary bg-clip-text text-8xl font-extrabold text-transparent duration-300"
          >
            {segundos > 0 ? segundos : "¡YA!"}
          </span>
        </div>
      </div>

      <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">Preparaos</span>

      {esUnoContraUno ? (
        <div className="absolute bottom-0 flex w-full max-w-xs items-center justify-between gap-2 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 backdrop-blur-md">
          <div className="flex min-w-0 items-center gap-2">
            <AvatarJugadorPartida jugador={jugadores[0]} />
            <p className="truncate text-xs font-bold text-foreground">{jugadores[0].nombre}</p>
          </div>
          <span className="shrink-0 text-sm font-extrabold text-[#D4AF37]">VS</span>
          <div className="flex min-w-0 flex-row-reverse items-center gap-2 text-right">
            <AvatarJugadorPartida jugador={jugadores[1]} />
            <p className="truncate text-xs font-bold text-foreground">{jugadores[1].nombre}</p>
          </div>
        </div>
      ) : (
        <div className="absolute bottom-0 flex w-full max-w-md flex-wrap items-center justify-center gap-3 rounded-2xl border border-border/60 bg-card/70 px-4 py-3 backdrop-blur-md">
          {jugadores.map((j) => (
            <div key={j.id} className="flex flex-col items-center gap-1">
              <AvatarJugadorPartida jugador={j} tamano="h-8 w-8 text-base" />
              <p className="max-w-14 truncate text-[10px] font-semibold text-muted-foreground">
                {j.esYo ? "Tú" : j.nombre}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Tablero del Top10 Online: rejilla de 10 posiciones (mismo orden visual
// -- 1-5 en la columna izquierda, 6-10 en la derecha -- que el modo
// individual, ver Top10Game.tsx), pero SIN el ranking completo: solo se
// conoce el nombre real de una posición cuando aparece en `miProgreso`
// (ver comentario de seguridad en EstadoPartidaTop10). La bandera, en
// cambio, se ve SIEMPRE desde el principio en las 10 -- es una pista a
// propósito, exactamente igual que el Top10 de Un Jugador (que también
// enseña la bandera de cada fila antes de acertarla) -- viene de
// `pistasNacionalidad`, que el servidor manda aparte del ranking
// completo (una bandera sola no delata el nombre). Versión más sencilla
// que la del modo individual (sin abreviar nombre por ResizeObserver ni
// colores oro/plata/bronce) -- aquí lo urgente es que funcione igual de
// bien en partida real, no replicar cada detalle visual del solitario.
function TableroTop10Online({
  totalPosiciones,
  miProgreso,
  pistasNacionalidad,
}: {
  totalPosiciones: number;
  miProgreso: Extract<EstadoPartida, { juego: "TOP10" }>["miProgreso"];
  pistasNacionalidad: Extract<EstadoPartida, { juego: "TOP10" }>["pistasNacionalidad"];
}) {
  const porPosicion = new Map(miProgreso.map((a) => [a.posicion, a.entrada]));

  return (
    <div
      className="grid w-full grid-cols-2 grid-flow-col gap-1.5 sm:gap-3"
      style={{ gridTemplateRows: `repeat(${Math.ceil(totalPosiciones / 2)}, minmax(0, 1fr))` }}
    >
      {Array.from({ length: totalPosiciones }, (_, i) => i + 1).map((posicion) => {
        const entrada = porPosicion.get(posicion);
        // La bandera sale de la pista del servidor (siempre disponible),
        // no de `entrada` -- así se ve desde el principio, no solo tras
        // acertar. Si ya acerté esa posición, `entrada.nacionalidad`
        // coincide con la pista de todos modos.
        const nacionalidad = pistasNacionalidad[posicion - 1] ?? null;
        const codigoPais = obtenerCodigoPais(nacionalidad);

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
            {codigoPais ? (
              <span className={`fi fi-${codigoPais} h-3 w-4 shrink-0 rounded-sm sm:h-5 sm:w-7`} />
            ) : (
              nacionalidad && (
                // Nacionalidad sin bandera mapeada todavía (ver
                // banderas.ts) -- en vez de dejar el hueco en blanco
                // (parecía "no ha cargado"), un indicador mínimo para que
                // quede claro que ahí falta ampliar el mapa, no que algo
                // se ha roto.
                <span className="flex h-3 w-4 shrink-0 items-center justify-center rounded-sm bg-muted text-[7px] font-bold text-muted-foreground sm:h-5 sm:w-7 sm:text-[9px]">
                  {nacionalidad.slice(0, 2).toUpperCase()}
                </span>
              )
            )}
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
  // Reloj local, solo para forzar el re-render del contador cada tanto --
  // NUNCA se usa para decidir el dígito que se pinta (ver `ahora` más
  // abajo). Arreglo del 07/09/2026: antes había un segundo `setInterval`
  // que decrementaba `segundosCuentaAtras`/`segundosRestantes` en local
  // ("s => s - 1") en paralelo al que los recalculaba de verdad contra
  // `empezadaEn` en cada poll -- los dos relojes competían por el mismo
  // estado, sin estar en fase entre sí ni con el otro jugador, así que un
  // dígito podía durar 0,1s si el poll corregía el valor justo antes de
  // que el tic local lo volviera a restar, y el "3" podía no llegar a
  // pintarse nunca. Ahora `segundosCuentaAtras`/`segundosRestantes` NO son
  // estado propio: se calculan en cada render a partir de `empezadaEn`
  // (el reloj compartido de servidor) y de `ahora`, así que solo hay una
  // fuente de verdad y los dos jugadores convergen al mismo dígito en el
  // mismo instante real, sin importar cuándo cada uno empezó a mirar.
  const [ahora, setAhora] = useState(() => Date.now());
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [confirmandoRendicion, setConfirmandoRendicion] = useState(false);
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
        // Ya NO se recalculan aquí `segundosCuentaAtras`/`segundosRestantes`
        // -- son valores derivados de `partida.empezadaEn` + `ahora` (ver
        // más abajo), no estado propio. El poll solo necesita refrescar
        // `partida` (que trae `empezadaEn` fresco de verdad); el reloj
        // local (`ahora`) se encarga de que el número avance entre polls.
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

  // Tic local -- solo actualiza `ahora`, nunca decrementa nada a mano.
  // 200ms (no 1000ms) para que el segundo cambie en pantalla sin esperar
  // hasta el próximo segundo entero una vez que `ahora` ya lo cruzó --
  // el dígito en sí sigue siendo un cálculo exacto contra `empezadaEn`,
  // esto solo dispara el re-render con la frecuencia suficiente para que
  // se sienta fluido.
  useEffect(() => {
    if (partida?.estado !== "EN_CURSO") return;
    const tic = setInterval(() => setAhora(Date.now()), 200);
    return () => clearInterval(tic);
  }, [partida?.estado]);

  // Cuenta atrás 3-2-1 (0 = "ya se puede jugar") y timer real de la ronda,
  // ambos derivados SIEMPRE del reloj compartido de servidor (`empezadaEn`)
  // más `ahora` -- nunca de un contador local que se decrementa a sí
  // mismo. Así, sin importar cuándo cada jugador empezó a observar la
  // cuenta atrás, los dos convergen al mismo dígito en el mismo instante
  // real (mismo criterio que ya se explica en el comentario largo de
  // /lib/salas.ts para el servidor).
  const empezadaEnMs = partida?.empezadaEn ? new Date(partida.empezadaEn).getTime() : null;
  // Cuánto falta para `empezadaEn` -- por encima de SEGUNDOS_CUENTA_ATRAS
  // todavía estamos en la revelación "cara a cara"; por debajo (y &gt; 0),
  // en el 3-2-1 numérico. Las dos fases comparten el mismo reloj de
  // servidor, así que quedan sincronizadas entre jugadores sin necesitar
  // nada más.
  const msHastaEmpezar = empezadaEnMs !== null ? empezadaEnMs - ahora : null;
  const segundosCuentaAtras =
    msHastaEmpezar !== null ? Math.max(0, Math.ceil(msHastaEmpezar / 1000)) : 0;
  // Fracción continua (1 = recién empezada, 0 = ya se acabó) para el aro
  // que se vacía en CuentaAtrasPartida -- a diferencia de
  // `segundosCuentaAtras` (entero, salta de 3 en 3 pasos), esto avanza
  // suave en cada tic de `ahora` (cada 200ms), así el aro se ve fluido en
  // vez de dar tres saltos bruscos.
  const fraccionCuentaAtras =
    empezadaEnMs !== null
      ? Math.min(1, Math.max(0, (empezadaEnMs - ahora) / (SEGUNDOS_CUENTA_ATRAS * 1000)))
      : 0;
  const segundosRestantes =
    empezadaEnMs !== null && partida
      ? Math.max(0, Math.min(partida.duracionSegundos, partida.duracionSegundos - Math.max(0, (ahora - empezadaEnMs) / 1000)))
      : 0;

  const esCreador = usuario && partida ? !partida.rivales.some((r) => r.esCreador) : false;

  // Tras FINALIZADA: si no soy el creador, vigilo /api/salas/[codigo] (el
  // mismo endpoint de la sala de espera) por si el anfitrión pide
  // revancha (vuelve a ESPERANDO) -- entonces me lleva solo a la sala de
  // espera, sin que tenga que hacer nada.
  useEffect(() => {
    // En ranked no hay revancha (cada partida sale de la cola, no tiene
    // "sala de espera" a la que volver) -- este polling no aplica.
    if (partida?.estado !== "FINALIZADA" || !usuario || esCreador || partida.competitiva) return;

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
  }, [partida?.estado, partida?.competitiva, codigo, usuario, router, esCreador]);

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

  // Equivalente a colocarJugador/acertarJugador pero para LINKPLAYERS --
  // tampoco hace falta elegir casilla, un único paso: se manda el
  // candidato y el servidor decide si conecta con el último eslabón de mi
  // cadena (y si con eso ya llego al jugador final, ver .../enlazar).
  async function enlazarJugador(jugador: Jugador) {
    setMensaje("");
    try {
      const res = await fetch(`/api/salas/${codigo}/enlazar`, {
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

  async function rendirse() {
    setMensaje("");
    try {
      const res = await fetch(`/api/salas/${codigo}/rendirse`, { method: "POST" });
      const datos = await res.json();
      if (!res.ok) {
        setMensaje(datos.error ?? "No se pudo abandonar la partida.");
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
    // Ranked no tiene "sala" a la que volver -- cada partida era privada
    // solo para esos dos, así que de vuelta va al hub, no a /multijugador.
    router.push(partida?.competitiva ? "/multijugador/ranked" : "/multijugador");
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
    // Antes era un simple texto suelto sin ningún diseño -- se veía justo
    // cuando el emparejamiento era instantáneo (el segundo jugador
    // encuentra al primero ya esperando) y la navegación a esta página
    // llegaba antes de que respondiera el primer fetch de la partida:
    // daba sensación de pantalla rota, cortando de golpe la confirmación
    // "¡Rival encontrado!" del hub. Mismo halo que ya usa CuentaAtrasPartida
    // más abajo, para que no haya un hueco visual en la transición.
    return (
      <div className="px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
        <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
          <div className="flex h-80 w-full flex-col items-center justify-center gap-4">
            <div className="launcher-halo-pulso flex h-16 w-16 items-center justify-center rounded-full border border-primary/35">
              <Image src="/LOGO ARENA-SinLetra.png" alt="" width={30} height={30} />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Cargando partida
            </span>
          </div>
        </div>
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
  const esperandoCarga = !finalizada && partida.empezadaEn === null;
  // "Revelación" (cara a cara) mientras falte MÁS de SEGUNDOS_CUENTA_ATRAS
  // para empezadaEn; el 3-2-1 numérico solo en los últimos
  // SEGUNDOS_CUENTA_ATRAS segundos -- ver el comentario largo junto a
  // SEGUNDOS_REVELACION_RIVAL en src/lib/salas.ts.
  const enRevelacion =
    !finalizada && !esperandoCarga && msHastaEmpezar !== null && msHastaEmpezar > SEGUNDOS_CUENTA_ATRAS * 1000;
  const enCuentaAtras = !finalizada && !esperandoCarga && !enRevelacion && segundosCuentaAtras > 0;
  const jugadoresEnfrentamiento: JugadorEnfrentamiento[] = usuario
    ? [
        { id: usuario.id, nombre: usuario.nombre, avatar: usuario.avatar, avatarTipo: usuario.avatarTipo, nivel: usuario.nivel, esYo: true },
        ...partida.rivales.map((r) => ({
          id: r.id,
          nombre: r.nombre,
          avatar: r.avatar,
          avatarTipo: r.avatarTipo,
          nivel: r.nivel,
          esYo: false,
        })),
      ]
    : [];

  return (
    <div className="px-4 pb-14 pt-8 sm:px-6 sm:pt-10">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6">
        {!finalizada && !esperandoCarga && !enRevelacion && !enCuentaAtras && (
          <div className="flex w-full max-w-md items-center justify-between">
            <span className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
              {partida.juego === "GRID"
                ? (ETIQUETA_DIFICULTAD[partida.dificultad] ?? partida.dificultad)
                : partida.juego === "LINKPLAYERS"
                  ? (ETIQUETA_DIFICULTAD_LINKPLAYERS[partida.dificultad] ?? partida.dificultad)
                  : "Top 10"}
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

        {/* "Abandonar partida" (07/09/2026) -- solo en Ranked (pedido
            explícito del usuario) y solo mientras se está jugando de
            verdad, no durante la revelación/cuenta atrás ni tras acabar.
            Rendirse cuenta como derrota (trofeos incluidos, igual que
            perder de cualquier otra forma) y al rival le aparece "se ha
            rendido" en vez del cartel de victoria genérico -- ver
            ResultadoPartida más abajo. */}
        {!finalizada && !esperandoCarga && !enRevelacion && !enCuentaAtras && partida.competitiva && (
          <button
            type="button"
            onClick={() => setConfirmandoRendicion(true)}
            className="text-xs font-semibold text-muted-foreground underline-offset-2 transition-colors hover:text-destructive hover:underline"
          >
            Abandonar partida
          </button>
        )}

        {finalizada ? (
          <ResultadoPartida
            partida={partida}
            esCreador={esCreador}
            onPedirRevancha={pedirRevancha}
            onSalir={() => setConfirmandoSalida(true)}
            onVolverRanked={salir}
            pidiendoRevancha={pidiendoRevancha}
          />
        ) : esperandoCarga ? (
          // Antes mostraba un contador "X/Y jugadores listos" que cambiaba
          // de número en fracciones de segundo (normal en un 1vs1: los dos
          // clientes llegan aquí casi a la vez) y se sentía como una
          // pantalla rota parpadeando. Ahora es visualmente IDÉNTICA al
          // halo de más arriba (estado `cargando`, antes del primer
          // fetch) -- aunque esta fase dure un instante, no hay ningún
          // cambio visual perceptible entre las dos, así que no puede dar
          // sensación de bug.
          <div className="flex h-80 w-full flex-col items-center justify-center gap-4">
            <div className="launcher-halo-pulso flex h-16 w-16 items-center justify-center rounded-full border border-primary/35">
              <Image src="/LOGO ARENA-SinLetra.png" alt="" width={30} height={30} />
            </div>
            <span className="text-xs font-bold uppercase tracking-[0.3em] text-muted-foreground">
              Cargando partida
            </span>
          </div>
        ) : enRevelacion ? (
          <RevelacionRivalPartida jugadores={jugadoresEnfrentamiento} />
        ) : enCuentaAtras ? (
          // Cuenta atrás 3-2-1: el tablero/ranking ya está cargado (fetch
          // hecho, solo que no se pinta todavía) -- lo único que falta es
          // que llegue el instante `empezadaEn` compartido.
          <CuentaAtrasPartida
            segundos={segundosCuentaAtras}
            fraccionRestante={fraccionCuentaAtras}
            jugadores={jugadoresEnfrentamiento}
          />
        ) : partida.juego === "GRID" ? (
          <SeccionGrid
            partida={partida}
            celdasPendientes={celdasPendientes}
            jugadorPendiente={jugadorPendiente}
            mensaje={mensaje}
            onColocar={colocarJugador}
            onSeleccionar={procesarSeleccion}
          />
        ) : partida.juego === "LINKPLAYERS" ? (
          <SeccionLinkPlayers partida={partida} mensaje={mensaje} onEnlazar={enlazarJugador} />
        ) : (
          <SeccionTop10 partida={partida} mensaje={mensaje} onAcertar={acertarJugador} />
        )}

        <ConfirmDialog
          open={confirmandoRendicion}
          onOpenChange={setConfirmandoRendicion}
          titulo="¿Abandonar la partida?"
          descripcion="Cuenta como derrota -- perderás trofeos igual que si perdieras jugando, y tu rival se lleva la victoria."
          textoConfirmar="Sí, abandonar"
          onConfirmar={rendirse}
        />

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

        <TableroTop10Online
          totalPosiciones={partida.objetivo}
          miProgreso={partida.miProgreso}
          pistasNacionalidad={partida.pistasNacionalidad}
        />

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

// Cadena LinkPlayers en curso -- mismo motivo que SeccionGrid/SeccionTop10:
// props tipadas al tipo LINKPLAYERS en vez de narrowing inline. Misma
// estructura general (buscador + rivales en rejilla/columna sticky) que
// las otras dos secciones -- FichaRival es 100% genérico (solo usa
// celdasResueltas/objetivo/completado/resultado), se reutiliza tal cual.
function SeccionLinkPlayers({
  partida,
  mensaje,
  onEnlazar,
}: {
  partida: Extract<EstadoPartida, { juego: "LINKPLAYERS" }>;
  mensaje: string;
  onEnlazar: (jugador: Jugador) => void;
}) {
  const nombresEnCadena = partida.miCadena.map((p) => p.jugador.nombre);
  const yaTermine = partida.miCadena[partida.miCadena.length - 1]?.jugador.nombre === partida.jugadorFinal.nombre;

  return (
    <div className="flex w-full flex-col items-center gap-6 lg:flex-row lg:items-start lg:justify-center">
      <div className="w-full max-w-md">
            <TarjetasObjetivo jugadorInicial={partida.jugadorInicial} jugadorFinal={partida.jugadorFinal} />

        <ul className="mt-6 flex w-full flex-col gap-2">
          {partida.miCadena.map((paso, i) => (
            <EslabonCadena
              key={`${paso.jugador.nombre}-${i}`}
              paso={paso}
              esFinal={i === partida.miCadena.length - 1 && yaTermine}
              esInicial={i === 0}
            />
          ))}
        </ul>

        <div className="mt-6 flex w-full justify-center">
          <PlayerSearch
            onSearch={buscarJugadores}
            excludeNames={nombresEnCadena}
            excludedLabel="Ya en la cadena"
            onSelect={onEnlazar}
            placeholder="Escribe el siguiente jugador..."
            disabled={yaTermine}
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
  onVolverRanked,
  pidiendoRevancha,
}: {
  partida: EstadoPartida;
  esCreador: boolean;
  onPedirRevancha: () => void;
  onSalir: () => void;
  onVolverRanked: () => void;
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

  // Si algún rival se rindió (07/09/2026, Ranked -- siempre 1vs1, así que
  // "algún" es "el único"), el ganador ve un título distinto al genérico
  // "¡Has ganado!" -- deja claro que el rival abandonó, no que perdió
  // jugando de verdad.
  const rivalRendido = partida.rivales.find((r) => r.rendido);
  const titulo =
    partida.miResultado === "VICTORIA"
      ? rivalRendido
        ? "Tu rival se ha rendido"
        : "¡Has ganado!"
      : partida.miResultado === "EMPATE"
        ? "Empate"
        : "Has perdido";
  const colorTitulo =
    partida.miResultado === "VICTORIA"
      ? "text-primary"
      : partida.miResultado === "EMPATE"
        ? "text-secondary"
        : "text-destructive";

  // LINKPLAYERS no tiene `miProgreso` (tiene `miCadena`, que YA incluye el
  // jugador inicial delante, ver EstadoPartidaLinkPlayers) -- se le resta
  // 1 para que cuente lo mismo que `celdasResueltas` en el servidor
  // (número de jugadores que YO he ido añadiendo, ver .../enlazar).
  const misCeldasResueltas = partida.juego === "LINKPLAYERS" ? partida.miCadena.length - 1 : partida.miProgreso.length;

  const clasificacion = [
    {
      id: usuario?.id ?? "yo",
      nombre: usuario?.nombre ?? "Tú",
      celdasResueltas: misCeldasResueltas,
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

      {/* Cambio de trofeos (Fase 5, 19/08/2026) -- solo en partidas
          competitivas, justo debajo de la EXP para que el orden de
          lectura sea "esto ganaste de EXP, esto te cambió el ranking". */}
      {partida.competitiva && (
        <CambioTrofeos
          cambio={partida.miTrofeosCambio}
          trofeosAntes={partida.miTrofeosAntes}
          trofeosDespues={partida.miTrofeosDespues}
        />
      )}

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
        {partida.competitiva ? (
          // Ranked no tiene revancha ni sala de espera a la que volver --
          // cada partida sale de la cola de emparejamiento, así que el
          // único paso siguiente natural es volver al hub competitivo.
          <GameButton onClick={onVolverRanked} className="w-full py-3">
            Volver al Competitivo
          </GameButton>
        ) : esCreador ? (
          <GameButton onClick={onPedirRevancha} disabled={pidiendoRevancha} className="w-full py-3">
            {pidiendoRevancha ? "Preparando revancha..." : "Volver a la sala de espera"}
          </GameButton>
        ) : (
          <p className="text-xs text-muted-foreground">Esperando a que el anfitrión decida qué hacer...</p>
        )}
        {!partida.competitiva && (
          <GameButton variant="destructive" onClick={onSalir} className="w-full">
            Salir
          </GameButton>
        )}
      </div>
    </div>
  );
}