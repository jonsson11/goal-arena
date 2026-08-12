import type { TipoAvatar } from "@/features/profile/type";
import type { Dificultad, Jugador } from "@/features/games/shared/types";
import type { Condicion } from "@/features/games/grid/type";
import type { EntradaTop10 } from "@/features/games/top10/type";
import type { JugadorObjetivo, PasoCadena } from "@/features/games/linkplayers/type";
import type { RespuestaPartida } from "@/lib/experiencia";

// Igual que PartidaJugada.juego -- texto libre, no enum. GRID, TOP10 y
// LINKPLAYERS (12/08/2026, Entrega 2) soportan multijugador (ver
// Sala.contenido en el schema: tablero, ranking o PartidaGenerada según el
// juego, reutilizando el mismo modelo de Sala en los tres casos, sin
// migración).
export type JuegoMultijugador = "GRID" | "TOP10" | "LINKPLAYERS";

export const JUEGOS_MULTIJUGADOR_DISPONIBLES: JuegoMultijugador[] = ["GRID", "TOP10", "LINKPLAYERS"];

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
  // ISO, o `null` mientras se espera a que todos carguen la pantalla de
  // partida (12/08/2026, arreglo de sincronización) -- el cliente NO debe
  // calcular ninguna cuenta atrás mientras sea null, solo enseñar una
  // pantalla de "cargando, esperando a los demás" (ver `cargados` debajo).
  // En cuanto deja de ser null, el cliente calcula el tiempo restante
  // contra este instante, nunca contra un cronómetro propio.
  empezadaEn: string | null;
  duracionSegundos: number;
  /** Cuántos aciertos hacen falta para completar la ronda -- 9 en GRID,
   * el tamaño del ranking (siempre 10 hoy) en TOP10. Lo manda el
   * servidor en vez de que cada juego lo asuma hardcodeado en el
   * cliente. */
  objetivo: number;
  /** Cuántos jugadores de la sala (yo incluido) ya han cargado la
   * pantalla de partida -- solo tiene sentido mientras `empezadaEn` es
   * null (para pintar "2/4 jugadores listos" en la pantalla de carga),
   * pero se manda siempre por simplicidad. El total es `rivales.length + 1`. */
  cargados: number;
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
  // Nacionalidad de cada posición (1-based, índice 0 = posición 1),
  // SIEMPRE visible desde el principio para las 10 -- a propósito, como
  // pista, igual que el Top10 de Un Jugador (que muestra la bandera de
  // cada fila aunque todavía no la hayas acertado). `null` si esa
  // posición ya está acertada (ahí la bandera de verdad sale de
  // `miProgreso`) o si el jugador no tiene nacionalidad registrada. Esto
  // NO es la solución -- una bandera por sí sola no te dice el nombre --
  // así que revelarla no rompe el criterio de seguridad de arriba.
  pistasNacionalidad: (string | null)[];
};
// LinkPlayers Multijugador (12/08/2026, Entrega 2) -- estructuralmente lo
// mismo que GRID/TOP10 (misma Sala, mismo mecanismo de cierre/EXP), pero
// reutilizando tal cual la lógica de generación/verificación del modo
// individual (generarPartida/verificarConexion, ver
// features/games/linkplayers/*.server.ts) en vez de duplicarla.
export type EstadoPartidaLinkPlayers = EstadoPartidaComun & {
  juego: "LINKPLAYERS";
  dificultad: Dificultad;
  jugadorInicial: JugadorObjetivo;
  jugadorFinal: JugadorObjetivo;
  // Steps mínimos reales entre inicial y final (mismo dato que en el modo
  // individual) -- puramente informativo aquí, ya no decide "completado"
  // (ver el comentario de `terminadaEn` en construirEstadoPartida/
  // finalizarPartidaSiToca en src/lib/salas.ts: a diferencia de GRID (9
  // casillas fijas) o TOP10 (tamaño fijo del ranking), la cadena de
  // LinkPlayers puede completarse con más Steps que el mínimo, así que no
  // hay un número fijo de "aciertos" que marque la meta).
  distanciaMinima: number;
  // Cadena YA COMPLETA (con el jugador inicial delante, a diferencia de
  // `SalaJugador.progreso` en BD que lo omite -- ver el endpoint
  // .../enlazar) -- el cliente la pinta tal cual, sin tener que
  // reconstruirla a partir de `jugadorInicial` + un progreso suelto.
  miCadena: PasoCadena[];
};

/** Forma exacta de GET /api/salas/[codigo]/partida -- lo que hace falta
 * para pintar el tablero/ranking/cadena propios y el progreso en vivo de
 * los rivales, sin más peticiones. Discriminada por `juego` -- comprueba
 * ese campo antes de leer el resto (TypeScript ya estrecha el tipo solo
 * con eso). */
export type EstadoPartida = EstadoPartidaGrid | EstadoPartidaTop10 | EstadoPartidaLinkPlayers;