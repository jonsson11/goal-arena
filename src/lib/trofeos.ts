// src/lib/trofeos.ts
//
// Todo el sistema de trofeos/ligas del modo competitivo (Grid Ranked, Fase
// 9), en funciones puras -- mismo criterio que ya sigue src/lib/
// experiencia.ts: nada de Prisma ni de Next aquí, para poder testear y
// reutilizar esto tanto en las rutas de API como en el cliente (mostrar la
// barra de progreso, previsualizar cuánto se ganaría/perdería...) sin
// arrastrar el runtime del servidor.
//
// Diseño completo, con el razonamiento de cada decisión, en el documento
// del proyecto "Modo competitivo (Fase 9) — Grid Ranked".

export type Liga = {
  /** Id estable, el que se guarda en HistorialTemporada.ligaFinal -- no
   * traducir/tocar aunque cambie el nombre visible en el futuro. */
  id: "CANTERANO" | "AMATEUR" | "SEMIPROFESIONAL" | "PROFESIONAL" | "INTERNACIONAL" | "LEYENDA";
  nombre: string;
  rangoMin: number;
  /** null = sin techo (Leyenda). */
  rangoMax: number | null;
  /** Color base del escudo/halo -- reutiliza los tokens de globals.css
   * cuando existen (bronze/silver/gold/primary/secondary), para que el
   * cosmético encaje con el resto de la identidad visual en vez de traer
   * una paleta nueva solo para esto. */
  color: string;
  /** Tono claro del degradado del escudo (highlight) / color de las
   * marcas del halo de avatar. */
  colorLuz: string;
  /** Cuántos "galones" lleva el escudo y cuántas marcas el halo de avatar
   * -- sube de 1 a 6 con la liga, para que el rango se lea contando
   * marcas y no solo por el color (ver mockup, feedback del 19/08/2026). */
  galones: number;
};

// Rangos de trofeos: primera estimación a ojo (mismo criterio ya usado en
// el proyecto para EXP/curvas de nivel) -- se recalibran con datos reales
// de la temporada 1 si hace falta, sin que eso rompa nada guardado (ver
// nota de HistorialTemporada.ligaFinal).
export const LIGAS: readonly Liga[] = [
  { id: "CANTERANO", nombre: "Canterano", rangoMin: 0, rangoMax: 299, color: "#7C8A99", colorLuz: "#B7C2CC", galones: 1 },
  { id: "AMATEUR", nombre: "Amateur", rangoMin: 300, rangoMax: 699, color: "#B4783D", colorLuz: "#E3A968", galones: 2 },
  { id: "SEMIPROFESIONAL", nombre: "Semiprofesional", rangoMin: 700, rangoMax: 1199, color: "#A8AEB8", colorLuz: "#DEE3E8", galones: 3 },
  { id: "PROFESIONAL", nombre: "Profesional", rangoMin: 1200, rangoMax: 1799, color: "#4ADE9A", colorLuz: "#9CF5C8", galones: 4 },
  { id: "INTERNACIONAL", nombre: "Internacional", rangoMin: 1800, rangoMax: 2499, color: "#1D7A9C", colorLuz: "#5FC2E8", galones: 5 },
  { id: "LEYENDA", nombre: "Leyenda", rangoMin: 2500, rangoMax: null, color: "#D4AF37", colorLuz: "#F7DE84", galones: 6 },
] as const;

export function ligaPorTrofeos(trofeos: number): Liga {
  const t = Math.max(0, trofeos);
  const encontrada = LIGAS.find((liga) => t >= liga.rangoMin && (liga.rangoMax === null || t <= liga.rangoMax));
  // No debería poder pasar (LIGAS cubre 0..infinito sin huecos), pero por
  // si acaso se desajustan los rangos en el futuro, caer en la más alta en
  // vez de reventar.
  return encontrada ?? LIGAS[LIGAS.length - 1];
}

export function ligaPorId(id: Liga["id"]): Liga {
  const liga = LIGAS.find((l) => l.id === id);
  if (!liga) throw new Error(`Liga desconocida: ${id}`);
  return liga;
}

export type ProgresoLiga = {
  liga: Liga;
  /** null si `liga` ya es la última (Leyenda, sin techo). */
  siguiente: Liga | null;
  /** Trofeos que faltan para la siguiente liga; null si no hay siguiente. */
  trofeosParaSiguiente: number | null;
  /** 0-100, para pintar la barra de progreso. 100 si no hay siguiente
   * liga (ya estás en la última). */
  porcentaje: number;
};

export function progresoLiga(trofeos: number): ProgresoLiga {
  const liga = ligaPorTrofeos(trofeos);
  const idx = LIGAS.findIndex((l) => l.id === liga.id);
  const siguiente = LIGAS[idx + 1] ?? null;

  if (!siguiente) {
    return { liga, siguiente: null, trofeosParaSiguiente: null, porcentaje: 100 };
  }

  const anchoLiga = siguiente.rangoMin - liga.rangoMin;
  const avance = trofeos - liga.rangoMin;
  const porcentaje = Math.min(100, Math.max(0, Math.round((avance / anchoLiga) * 100)));

  return {
    liga,
    siguiente,
    trofeosParaSiguiente: Math.max(0, siguiente.rangoMin - trofeos),
    porcentaje,
  };
}

// ---------------------------------------------------------------
// Cálculo de trofeos (Elo simplificado)
// ---------------------------------------------------------------

// "Volumen" de trofeos en juego por partida -- más alto = el ranking
// reacciona más rápido a cada partida, más bajo = más estable pero tarda
// más en reflejar tu nivel real. 32 es el valor clásico de arranque en
// sistemas Elo, buen punto de partida antes de tener datos reales que
// sugieran otra cosa.
const K_FACTOR = 32;

// En empate, ambos jugadores ganan una pequeña cantidad en vez de que uno
// gane y otro pierda -- ver reglas de empate ya decididas en el diseño de
// Arena (Fase 9). 0.15 de K friendo un empate a nivel similar en ~5
// trofeos, un bonus de participación real pero menor que una victoria.
const BONUS_EMPATE_FACTOR = 0.15;

export type ResultadoRanked = "VICTORIA" | "DERROTA" | "EMPATE";

/** Probabilidad esperada de que el jugador con `trofeosPropios` gane
 * contra uno con `trofeosRival`, fórmula Elo estándar. Symmetric:
 * probabilidadEsperada(a,b) + probabilidadEsperada(b,a) === 1. */
function probabilidadEsperada(trofeosPropios: number, trofeosRival: number): number {
  return 1 / (1 + Math.pow(10, (trofeosRival - trofeosPropios) / 400));
}

/** Cuánto cambian los trofeos de UN jugador tras una partida ranked --
 * llamar una vez por jugador (con su resultado respectivo) al cerrar la
 * partida. Puede devolver negativo (derrota). No aplica el resultado a
 * ningún total -- eso lo hace `aplicarCambioTrofeos`, para poder
 * previsualizar el cambio sin tocar nada (p. ej. en el cliente, antes de
 * que el servidor confirme el cierre real). */
export function calcularCambioTrofeos(
  trofeosPropios: number,
  trofeosRival: number,
  resultado: ResultadoRanked
): number {
  const esperado = probabilidadEsperada(trofeosPropios, trofeosRival);

  if (resultado === "EMPATE") {
    return Math.round(K_FACTOR * BONUS_EMPATE_FACTOR);
  }
  if (resultado === "VICTORIA") {
    return Math.round(K_FACTOR * (1 - esperado));
  }
  // DERROTA
  return -Math.round(K_FACTOR * esperado);
}

/** Aplica un cambio de trofeos ya calculado, sin dejar que el total baje
 * de 0 (floor) -- toda lectura de "trofeos actuales" debe pasar por aquí
 * en vez de sumar a mano, para no tener que acordarse del floor en cada
 * sitio que toque `User.trofeos`. */
export function aplicarCambioTrofeos(trofeosActuales: number, cambio: number): number {
  return Math.max(0, trofeosActuales + cambio);
}

// ---------------------------------------------------------------
// Emparejamiento (cola)
// ---------------------------------------------------------------

// Rango de trofeos aceptable entre dos jugadores en cola, en función de
// cuántos segundos lleva esperando el que más tiempo lleva -- empieza
// estrecho y se amplía sin techo, para no dejar a nadie esperando
// indefinidamente solo por no tener un rival calcado (ver documento de
// diseño, aviso sobre población pequeña).
const RANGO_INICIAL = 75;
const AMPLIACION_POR_TRAMO = 25;
const SEGUNDOS_POR_TRAMO = 15;

export function rangoAceptableTrofeos(segundosEsperando: number): number {
  const tramos = Math.floor(Math.max(0, segundosEsperando) / SEGUNDOS_POR_TRAMO);
  return RANGO_INICIAL + tramos * AMPLIACION_POR_TRAMO;
}

/** ¿Son estos dos jugadores en cola un emparejamiento válido AHORA MISMO,
 * dado cuánto lleva esperando cada uno? Se usa el rango más generoso de
 * los dos (el que más tiempo lleva esperando "tira" del rango hacia
 * arriba para ambos), para que a quien lleva mucho esperando no le siga
 * penalizando la espera corta del otro. */
export function sonEmparejablesEnCola(
  a: { trofeos: number; segundosEsperando: number },
  b: { trofeos: number; segundosEsperando: number }
): boolean {
  const rango = Math.max(rangoAceptableTrofeos(a.segundosEsperando), rangoAceptableTrofeos(b.segundosEsperando));
  return Math.abs(a.trofeos - b.trofeos) <= rango;
}
