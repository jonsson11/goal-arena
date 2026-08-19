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

// ---------------------------------------------------------------
// Cosméticos de liga (Fase 5, 19/08/2026) -- permanentes y opcionales:
// una vez alcanzada una liga (según `trofeosMaximos`, el pico histórico,
// nunca la liga actual en vivo) queda desbloqueada para siempre como
// cosmético, aunque luego bajes de trofeos o haya un reset de temporada.
// El jugador puede "equipar" cualquiera de las que tenga desbloqueadas
// para presumir de un hito pasado, en vez de estar atado siempre a su
// liga actual.
// ---------------------------------------------------------------

/** ¿Tiene desbloqueado el cosmético de esta liga? -- alcanzarla alguna
 * vez (pico histórico) basta, no hace falta seguir estando en ella. */
export function ligaDesbloqueadaComoCosmetico(ligaId: Liga["id"], trofeosMaximos: number): boolean {
  const liga = LIGAS.find((l) => l.id === ligaId);
  return liga !== undefined && trofeosMaximos >= liga.rangoMin;
}

// Valor especial de `User.aroEquipado` (además de un id de Liga o `null`)
// para "no quiero ningún aro, solo mi avatar" -- pedido explícito del
// usuario (19/08/2026): tan válido como elegir una liga concreta o dejarlo
// en automático.
export const ARO_OCULTO = "OCULTO";

/** La liga que hay que MOSTRAR de verdad como aro de avatar (Header,
 * Perfil...): `null` si el jugador ha elegido no mostrar ningún aro. Si ha
 * elegido un cosmético concreto (y sigue desbloqueado -- por si algún día
 * se recalibran los rangos de liga y un id deja de tener sentido) se
 * muestra ese; si no ha tocado nada, la liga actual en vivo, comportamiento
 * de siempre. Centralizado aquí para que ningún sitio de la UI tenga que
 * repetir este if/else. */
export function ligaMostrada(trofeos: number, trofeosMaximos: number, aroEquipado: string | null): Liga | null {
  if (aroEquipado === ARO_OCULTO) return null;
  if (aroEquipado) {
    const elegida = LIGAS.find((l) => l.id === aroEquipado);
    if (elegida && ligaDesbloqueadaComoCosmetico(elegida.id, trofeosMaximos)) return elegida;
  }
  return ligaPorTrofeos(trofeos);
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
// Cálculo de trofeos (estilo Clash Royale, revisado 19/08/2026)
// ---------------------------------------------------------------
//
// Primera versión (Elo clásico, K=32) daba cambios pequeños y muy planos
// cerca del 50/50 (una victoria "normal" apenas subía ~16 trofeos) --
// pedido explícito del usuario: que se suba MÁS por victoria (~30 de
// media, como el estilo Clash Royale) y que la variación por rival sea
// una horquilla pequeña alrededor de esa media, no el rango amplio que
// daba la fórmula Elo pura.
//
// Diseño: base fija de 30 trofeos por victoria, con un ajuste de hasta
// ±3 según qué tan favorito/infravalorado eras contra ese rival --
// vencer a alguien con más trofeos que tú (ibas de infravalorado) da más
// (hasta 33); vencer a alguien con menos (ibas de favorito) da menos
// (hasta 27). La derrota es la imagen especular: perder contra alguien
// mejor (se esperaba) cuesta menos (-27); perder contra alguien peor (un
// palo inesperado) cuesta más (-33). Resultado: victorias siempre entre
// 27-33, derrotas siempre entre -27 y -33, nunca los extremos disparados
// que podía dar el Elo puro con diferencias de trofeos muy grandes.

const BASE_TROFEOS_VICTORIA = 30;
// Rango resultante: victorias entre 30-3=27 y 30+3=33 (y su espejo en derrota).
const VARIANZA_MAXIMA_TROFEOS = 3;

// En empate, ambos jugadores ganan una pequeña cantidad fija -- no hay
// "favorito"/"infravalorado" que valga en un empate, así que aquí no
// aplica la variación por rival, solo un bonus de participación menor
// que cualquier victoria.
const TROFEOS_EMPATE = 10;

export type ResultadoRanked = "VICTORIA" | "DERROTA" | "EMPATE";

/** Probabilidad esperada de que el jugador con `trofeosPropios` gane
 * contra uno con `trofeosRival`, fórmula Elo estándar -- se sigue usando
 * aquí solo para decidir CUÁNTO te desvías de la base de 30, no para el
 * cambio de trofeos en sí. Symmetric: probabilidadEsperada(a,b) +
 * probabilidadEsperada(b,a) === 1. */
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
  if (resultado === "EMPATE") {
    return TROFEOS_EMPATE;
  }

  // `esperado` = probabilidad de que TÚ ganaras. Cerca de 0 = eras el
  // infravalorado (rival con más trofeos); cerca de 1 = eras el favorito.
  const esperado = probabilidadEsperada(trofeosPropios, trofeosRival);

  // De +3 (infravalorado, esperado=0) a -3 (favorito, esperado=1), pasando
  // por 0 en un emparejamiento parejo (esperado=0.5).
  const ajusteSinRecortar = Math.round(VARIANZA_MAXIMA_TROFEOS * (1 - 2 * esperado));
  const ajuste = Math.max(-VARIANZA_MAXIMA_TROFEOS, Math.min(VARIANZA_MAXIMA_TROFEOS, ajusteSinRecortar));

  if (resultado === "VICTORIA") {
    return BASE_TROFEOS_VICTORIA + ajuste; // 27 (favorito) .. 33 (infravalorado)
  }
  // DERROTA -- mismo `ajuste` (calculado con TU perspectiva, no cambia
  // según el resultado): perder de favorito cuesta más, perder de
  // infravalorado cuesta menos.
  return -(BASE_TROFEOS_VICTORIA - ajuste); // -27 (ibas de infravalorado) .. -33 (ibas de favorito)
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
