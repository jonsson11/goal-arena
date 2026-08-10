import type { TipoAvatar } from "@/features/profile/type";
import type { Dificultad, Jugador } from "@/features/games/shared/types";
import type { Condicion } from "@/features/games/grid/type";
import type { EntradaTop10 } from "@/features/games/top10/type";
import type { RespuestaPartida } from "@/lib/experiencia";

// Igual que PartidaJugada.juego -- texto libre, no enum. GRID y TOP10
// soportan multijugador (ver Sala.contenido en el schema: tablero o
// ranking según el juego, reutilizando el mismo modelo de Sala en los dos
// casos, sin migración).
export type JuegoMultijugador = "GRID" | "TOP10";

export const JUEGOS_MULTIJUGADOR_DISPONIBLES: JuegoMultijugador[] = ["GRID", "TOP10"];

export type EstadoSala = "ESPERANDO" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";

export type JugadorSala = {
  id: string; // id de usuario, no de la fila SalaJugador
  nombre: string;
  avatar: string;
  avatarTipo: TipoAvatar;
  listo: boolean;
  esCreador: boolean;
  amistad?: "AMIGOS" | "PENDIENTE" | "NINGUNA" | "YO";
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

/** Una casilla que YO he resuelto -- lo que se guarda en SalaJugador.progreso
 * cuando `juego === "GRID"`. */
export type ColocacionPropia = { fila: number; columna: number; jugador: Jugador };

/** Una posición del Top10 que YO he acertado -- lo que se guarda en
 * SalaJugador.progreso cuando `juego === "TOP10"`. `posicion` es 1-based
 * (1 = primer puesto del ranking), igual que se pinta en el tablero. */
export type AciertoPropioTop10 = { posicion: number; entrada: EntradaTop10 };

/** Estado de un rival durante la partida -- deliberadamente SIN el
 * detalle de qué ha colocado/acertado (solo el contador), para no dar
 * pistas. `celdasResueltas` se reutiliza tal cual para TOP10 (mismo
 * campo en BD, SalaJugador.celdasResueltas): ahí cuenta "aciertos", no
 * casillas, pero el nombre del campo no vale la pena migrarlo solo por
 * esto. */
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

type EstadoPartidaComun = {
  estado: EstadoSala; // "EN_CURSO" mientras se juega, "FINALIZADA" al acabar
  miResultado: "VICTORIA" | "DERROTA" | "EMPATE" | null;
  miExperiencia: RespuestaPartida | null;
  rivales: RivalPartida[];
  empezadaEn: string; // ISO -- el cliente calcula el tiempo restante contra esto, no contra un cronómetro propio
  duracionSegundos: number;
  /** Cuántos aciertos hacen falta para completar la ronda -- 9 en GRID,
   * el tamaño del ranking (siempre 10 hoy) en TOP10. Lo manda el
   * servidor en vez de que cada juego lo asuma hardcodeado en el
   * cliente. */
  objetivo: number;
};

export type EstadoPartidaGrid = EstadoPartidaComun & {
  juego: "GRID";
  dificultad: Dificultad;
  // Condiciones del tablero (mismo tipo que el modo individual) -- las
  // celdas se reconstruyen en el cliente cruzando esto con `miProgreso`.
  condicionesFila: [Condicion, Condicion, Condicion];
  condicionesColumna: [Condicion, Condicion, Condicion];
  miProgreso: ColocacionPropia[];
};

export type EstadoPartidaTop10 = EstadoPartidaComun & {
  juego: "TOP10";
  dificultad: null;
  titulo: string;
  descripcion?: string;
  // OJO: aquí NO va la lista de respuestas reales (eso sería mandar la
  // solución entera al cliente y cualquiera podría verla por la pestaña
  // de red del navegador) -- solo lo que YO ya he acertado, en
  // `miProgreso`. Mismo criterio de seguridad que GRID, que tampoco manda
  // qué jugador va en cada casilla hasta que tú lo colocas.
  miProgreso: AciertoPropioTop10[];
};

/** Forma exacta de GET /api/salas/[codigo]/partida -- lo que hace falta
 * para pintar el tablero/ranking propio y el progreso en vivo de los
 * rivales, sin más peticiones. Discriminada por `juego` -- comprueba ese
 * campo antes de leer el resto (TypeScript ya estrecha el tipo solo con
 * eso). */
export type EstadoPartida = EstadoPartidaGrid | EstadoPartidaTop10;