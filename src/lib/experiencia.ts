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
//
// Subidas el 04/08/2026, ajustadas a mano por el usuario tras probar una
// primera propuesta más conservadora: multiplicador limpio x2 por escalón
// de dificultad en GRID (25 / 50 / 100), y TOP10 justo en el punto medio
// entre GRID medio y difícil ((50+100)/2 = 75), como pedía el comentario
// de arriba desde el principio.
export const EXP_VICTORIA: Record<string, number> = {
  "GRID:facil": 25,
  "GRID:medio": 50,
  "GRID:dificil": 100,
  "TOP10:": 75, // TOP10 sin modo -- ver claveModo()
};

/** Bonus por la primera victoria del día, cualquier modo. Se sujeta a
 * `ultimoBonusDiario` en User -- ver estaDisponibleBonusDiario(). Iguala
 * al máximo por partida suelta (GRID difícil) -- sigue sin ser
 * desproporcionado porque solo se cobra una vez al día, no repetible. */
export const BONUS_DIARIO_EXP = 100;

// ────────────────────────────────────────────────────────────────
// Bonus por rapidez
// ────────────────────────────────────────────────────────────────
//
// Añadido el 04/08/2026 para que no siempre se gane la misma EXP en la
// misma partida -- un extra en % sobre expBase según lo rápido que se
// haya completado, comparado con una "duración esperada" por juego/modo
// (no un tiempo fijo en segundos igual para todos, para que GRID difícil
// -que requiere pensar más cada casilla- no compita en igualdad de
// condiciones con GRID fácil). Se mide en fracciones de esa duración
// esperada para que sea fácil de tocar: para recalibrar un modo completo
// solo hace falta cambiar UN número (su duración esperada), no los tres
// tramos de bonus.
//
//   tiempo real <= 50% de lo esperado  -> +50% EXP (partida relámpago)
//   tiempo real <= 100% de lo esperado -> +25% EXP (partida rápida)
//   tiempo real <= 150% de lo esperado -> +10% EXP (ritmo normal-alto)
//   más lento que eso                  -> +0% (nunca resta, solo no suma)
//
// Las duraciones esperadas son una primera estimación a ojo (90s/120s/
// 180s de GRID según dificultad, 120s para TOP10) -- exactamente igual que
// la curva de niveles o el reparto de EXP, es la primera vuelta de tuerca:
// si con partidas reales se ve que casi todo el mundo cae siempre en el
// tramo top o nunca lo alcanza, se ajustan estos números y ya está.
const DURACION_ESPERADA_SEGUNDOS: Record<string, number> = {
  "GRID:facil": 90,
  "GRID:medio": 120,
  "GRID:dificil": 180,
  "TOP10:": 120,
};

const TRAMOS_BONUS_TIEMPO: Array<{ hastaFraccion: number; bonusPct: number }> = [
  { hastaFraccion: 0.5, bonusPct: 50 },
  { hastaFraccion: 1.0, bonusPct: 25 },
  { hastaFraccion: 1.5, bonusPct: 10 },
];

/** % extra de EXP según lo rápido que se completó la partida frente a la
 * duración esperada de ese juego/modo. 0 si no hay duración esperada
 * configurada para la combinación, o si `segundos` no es un número válido
 * (el cliente manda el tiempo, así que se trata como dato opcional -- si
 * viene raro, simplemente no hay bonus, no se rechaza la partida entera). */
export function bonusPorcentajePorTiempo(juego: JuegoPartida, modo: string | null, segundos: number): number {
  const duracionEsperada = DURACION_ESPERADA_SEGUNDOS[claveModo(juego, modo)];
  if (!duracionEsperada || !Number.isFinite(segundos) || segundos <= 0) return 0;

  const fraccion = segundos / duracionEsperada;
  const tramo = TRAMOS_BONUS_TIEMPO.find((t) => fraccion <= t.hastaFraccion);
  return tramo?.bonusPct ?? 0;
}

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
// Como toda curva de niveles, esto es una primera vuelta de tuerca: si
// tras un par de días jugando se sigue sintiendo lenta o rápida, es
// cuestión de tocar estos dos números (40 y 1.35) otra vez. Ojo: con las
// recompensas por victoria más altas de más arriba (25/50/100/75) y el
// bono por rapidez de aquí abajo, el ritmo real de subida es bastante más
// rápido que estos números por sí solos sugieren.
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

/** Desglose completo de cuánta EXP da una victoria: base del modo, más el
 * % extra por rapidez (redondeado, ver bonusPorcentajePorTiempo), más el
 * bono diario si tocaba. Centralizado aquí (en vez de calculado a mano en
 * POST /api/partidas) para que el orden de aplicación de los bonus --
 * rapidez sobre la base, bono diario aparte, sin componerse entre sí --
 * quede en un único sitio y no haya que recordarlo en cada llamada. */
export type ExperienciaVictoria = {
  expBase: number;
  bonusTiempoPct: number;
  expTiempoExtra: number;
  bonusDiario: boolean;
  expGanada: number;
};

export function calcularExperienciaVictoria(
  juego: JuegoPartida,
  modo: string | null,
  segundos: number,
  bonusDiarioDisponible: boolean
): ExperienciaVictoria {
  const expBase = expBasePorVictoria(juego, modo);
  const bonusTiempoPct = bonusPorcentajePorTiempo(juego, modo, segundos);
  const expConTiempo = Math.round(expBase * (1 + bonusTiempoPct / 100));
  const expTiempoExtra = expConTiempo - expBase;

  return {
    expBase,
    bonusTiempoPct,
    expTiempoExtra,
    bonusDiario: bonusDiarioDisponible,
    expGanada: expConTiempo + (bonusDiarioDisponible ? BONUS_DIARIO_EXP : 0),
  };
}

/** Forma exacta que devuelve POST /api/partidas -- compartida entre el
 * endpoint y el cliente (useRegistrarPartida.ts, ExperienciaGanada.tsx)
 * para no repetir el tipo en los dos sitios. */
export type RespuestaPartida = {
  estadoAntes: EstadoNivel;
  estadoDespues: EstadoNivel & { subioDeNivel: boolean };
  expBase: number;
  bonusTiempoPct: number;
  expTiempoExtra: number;
  bonusDiario: boolean;
  expGanada: number;
};
