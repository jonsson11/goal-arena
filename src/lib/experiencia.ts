// src/lib/experiencia.ts
//
// Todo lo relacionado con niveles y EXP, en un solo sitio para que el
// backend (POST /api/partidas) y cualquier otro código que necesite
// simularlo (tests, scripts) usen exactamente la misma curva. No importa
// nada de Prisma ni de Next -- es lógica pura, fácil de razonar y de
// probar suelta.

/** Los dos minijuegos activos hoy. Añadir uno nuevo no pide migración
 * (ver comentario de PartidaJugada.juego en schema.prisma) -- solo hay
 * que añadirlo aquí y a EXP_VICTORIA. */
export const JUEGOS_VALIDOS = ["GRID", "TOP10"] as const;
export type JuegoPartida = (typeof JUEGOS_VALIDOS)[number];

export type Dificultad = "facil" | "medio" | "dificil";
const DIFICULTADES_VALIDAS: readonly Dificultad[] = ["facil", "medio", "dificil"];

export type ResultadoPartida = "victoria" | "derrota";

// ────────────────────────────────────────────────────────────────
// Recompensas por victoria
// ────────────────────────────────────────────────────────────────
//
// GRID tiene 3 modos con dificultad creciente de verdad (menos pistas,
// tableros más exigentes), así que su EXP escala con ella. TOP10 no tiene
// modos hoy -- una sola dificultad, EXP fija a medio camino entre el GRID
// medio y difícil (acertar 10 nombres de memoria no es trivial, pero
// tampoco exige tanto como el 3x3 en difícil).
export const EXP_VICTORIA: Record<string, number> = {
  "GRID:facil": 15,
  "GRID:medio": 25,
  "GRID:dificil": 40,
  "TOP10:": 30, // TOP10 sin modo -- ver claveModo()
};

/** Bonus por la primera victoria del día, cualquier modo. Se sujeta a
 * `ultimoBonusDiario` en User -- ver estaDisponibleBonusDiario(). Es más
 * alto que cualquier victoria suelta a propósito: quiere premiar volver
 * cada día, no solo jugar mucho de una sentada. */
export const BONUS_DIARIO_EXP = 50;

function claveModo(juego: JuegoPartida, modo: string | null): string {
  return `${juego}:${modo ?? ""}`;
}

/** Valida la pareja (juego, modo) que manda el cliente antes de fiarse de
 * ella para nada -- ver POST /api/partidas. */
export function esCombinacionValida(juego: string, modo: string | null): juego is JuegoPartida {
  if (!JUEGOS_VALIDOS.includes(juego as JuegoPartida)) return false;
  if (juego === "GRID") return modo !== null && DIFICULTADES_VALIDAS.includes(modo as Dificultad);
  // TOP10 (y cualquier futuro juego sin modos): modo debe venir vacío.
  return modo === null;
}

export function expBasePorVictoria(juego: JuegoPartida, modo: string | null): number {
  return EXP_VICTORIA[claveModo(juego, modo)] ?? 0;
}

// ────────────────────────────────────────────────────────────────
// Curva de niveles
// ────────────────────────────────────────────────────────────────
//
// xpParaNivel(n) = EXP que hace falta para pasar del nivel n al n+1.
// Reajustada el 04/08/2026 a petición del usuario tras probarla en real:
// la versión anterior (exponente 1.55) se sentía demasiado lenta ya desde
// el primer nivel, y muy brusca de golpe a partir del ~15-20. Con
// exponente 1.35 (y una base más baja, 40 en vez de 60) la curva sigue
// siendo "fácil empezar, más exigente después", pero más suave en todo su
// recorrido -- se sube de nivel más rápido al principio Y el salto hacia
// niveles altos es proporcionalmente menos brusco, en vez de concentrar
// toda la dificultad de golpe. Redondeado a la decena, igual que antes.
//
//   nivel   EXP para el siguiente   EXP acumulada
//     1             40                     40
//     5            350                    930
//    10            900                  4.270
//    20          2.280                 20.590
//    25          3.090                 34.400
//
// Ejemplo real (el mismo caso que reportó el usuario): ganar el primer
// Grid en fácil con el bono diario de la jornada (15 + 50 = 65 EXP) ya dejaba
// al jugador a mitad de camino del nivel 2 (40 EXP), en vez de solo un 65%
// de un nivel que pedía 100 -- el primer nivel ahora cae prácticamente del
// tirón. Como toda curva de niveles, esto es una primera vuelta de tuerca:
// si tras un par de días jugando se sigue sintiendo lenta o rápida, es
// cuestión de tocar estos dos números (40 y 1.35) otra vez.
export function xpParaNivel(nivel: number): number {
  return Math.round((40 * Math.pow(nivel, 1.35)) / 10) * 10;
}

export type EstadoNivel = {
  nivel: number;
  xpActual: number;
  xpSiguienteNivel: number;
};

/** Aplica `xpGanada` a un estado de nivel y devuelve el nuevo estado,
 * subiendo de nivel tantas veces como haga falta (por si una sola
 * partida diera, en teoría, EXP para más de un nivel de golpe). */
export function aplicarExperiencia(estado: EstadoNivel, xpGanada: number): EstadoNivel & { subioDeNivel: boolean } {
  let nivel = estado.nivel;
  let xpActual = estado.xpActual + xpGanada;
  let xpSiguienteNivel = estado.xpSiguienteNivel;
  let subioDeNivel = false;

  while (xpActual >= xpSiguienteNivel) {
    xpActual -= xpSiguienteNivel;
    nivel += 1;
    xpSiguienteNivel = xpParaNivel(nivel);
    subioDeNivel = true;
  }

  return { nivel, xpActual, xpSiguienteNivel, subioDeNivel };
}

// ────────────────────────────────────────────────────────────────
// Bonus diario -- "hoy" se define por el calendario de España, no UTC.
// Sin esto, alguien que juega a la 1am en España (23:00 UTC del día
// anterior) vería el bonus resetearse a medianoche UTC, dos horas antes
// de lo que le corresponde -- o al revés, según la época del año.
// ────────────────────────────────────────────────────────────────

const FORMATEADOR_FECHA_ESPANA = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Madrid",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** "YYYY-MM-DD" del día de calendario en España para una fecha dada. */
export function diaEnEspana(fecha: Date): string {
  return FORMATEADOR_FECHA_ESPANA.format(fecha);
}

export function estaDisponibleBonusDiario(ultimoBonusDiario: Date | null, ahora: Date): boolean {
  if (!ultimoBonusDiario) return true;
  return diaEnEspana(ultimoBonusDiario) !== diaEnEspana(ahora);
}

/** Forma exacta que devuelve POST /api/partidas -- compartida entre el
 * endpoint y el cliente (useRegistrarPartida.ts, ExperienciaGanada.tsx)
 * para no repetir el tipo en los dos sitios. */
export type RespuestaPartida = {
  estadoAntes: EstadoNivel;
  estadoDespues: EstadoNivel & { subioDeNivel: boolean };
  expBase: number;
  bonusDiario: boolean;
  expGanada: number;
};
