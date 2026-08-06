import type { TipoAvatar } from "@/features/profile/type";
import type { Dificultad, Jugador } from "@/features/games/shared/types";
import type { Condicion } from "@/features/games/grid/type";
import type { RespuestaPartida } from "@/lib/experiencia";

// Igual que PartidaJugada.juego -- texto libre, no enum. Hoy solo GRID
// soporta multijugador; TOP10 se añade en una fase posterior sin migrar
// nada, reutilizando este mismo modelo de Sala.
export type JuegoMultijugador = "GRID";

export const JUEGOS_MULTIJUGADOR_DISPONIBLES: JuegoMultijugador[] = ["GRID"];

export type EstadoSala = "ESPERANDO" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";

export type JugadorSala = {
  id: string; // id de usuario, no de la fila SalaJugador
  nombre: string;
  avatar: string;
  avatarTipo: TipoAvatar;
  listo: boolean;
  esCreador: boolean;
};

export type Sala = {
  codigo: string;
  juego: JuegoMultijugador;
  dificultad: Dificultad | null;
  maxJugadores: number;
  estado: EstadoSala;
  creadorId: string;
  jugadores: JugadorSala[];
};

// ────────────────────────────────────────────────────────────────
// Partida en directo (Fase 2, 06/08/2026)
// ────────────────────────────────────────────────────────────────

/** Una casilla que YO he resuelto -- lo que se guarda en SalaJugador.progreso. */
export type ColocacionPropia = { fila: number; columna: number; jugador: Jugador };

/** Estado de un rival durante la partida -- deliberadamente SIN el
 * detalle de qué ha colocado (solo el contador), para no dar pistas. */
export type RivalPartida = {
  id: string;
  nombre: string;
  avatar: string;
  avatarTipo: TipoAvatar;
  esCreador: boolean;
  celdasResueltas: number;
  completado: boolean;
  /** Solo se rellena tras FINALIZADA. */
  resultado: "VICTORIA" | "DERROTA" | "EMPATE" | null;
};

/** Forma exacta de GET /api/salas/[codigo]/partida -- lo que hace falta
 * para pintar el tablero propio (condiciones + mis casillas) y el
 * progreso en vivo de los rivales, sin más peticiones. */
export type EstadoPartida = {
  estado: EstadoSala; // "EN_CURSO" mientras se juega, "FINALIZADA" al acabar
  juego: JuegoMultijugador;
  dificultad: Dificultad | null;
  // Condiciones del tablero (mismo tipo que el modo individual) -- las
  // celdas se reconstruyen en el cliente cruzando esto con `miProgreso`.
  condicionesFila: [Condicion, Condicion, Condicion];
  condicionesColumna: [Condicion, Condicion, Condicion];
  miProgreso: ColocacionPropia[];
  miResultado: "VICTORIA" | "DERROTA" | "EMPATE" | null;
  miExperiencia: RespuestaPartida | null;
  rivales: RivalPartida[];
  empezadaEn: string; // ISO -- el cliente calcula el tiempo restante contra esto, no contra un cronómetro propio
  duracionSegundos: number;
};