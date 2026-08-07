// src/lib/logros.ts
//
// Catálogo COMPLETO de logros -- vive en código a propósito, no en la
// base de datos (ver comentario largo junto a LogroReclamado en el
// schema). Cada logro tiene un `id` estable: si algún día cambias el
// `nombre` o la `descripcion` de uno, no pasa nada, pero NUNCA cambies un
// `id` ya publicado -- perderías el rastro de quién lo tenía reclamado
// (LogroReclamado.logroId apunta a este id como texto suelto).
//
// Compartido entre servidor y cliente: aquí no hay nada de Prisma ni de
// "SOLO SERVIDOR", así que este archivo es seguro de importar tanto desde
// las rutas de API (para saber el umbral/recompensa de cada logro) como
// desde los componentes (para pintar el catálogo completo, incluidos los
// que el usuario todavía no ha desbloqueado).

export type TierLogro = "bronce" | "plata" | "oro" | "esmeralda" | "zafiro" | "amatista" | "rubi" | "legendario";

// Categoría = a qué "pista" pertenece un logro. Varios logros de la misma
// categoría comparten el mismo contador de progreso (ver
// src/lib/progresoLogros.ts) y solo cambian en el `umbral` que hay que
// alcanzar -- por eso todos excepto "especial" forman una progresión
// clara (nivel 1 -> 5 -> 10..., racha 5 -> 10 -> 20...).
export type CategoriaLogro =
  | "nivel"
  | "amigos"
  | "multijugador-jugadas"
  | "victorias-grid"
  | "victorias-top10"
  | "dificil"
  | "racha"
  | "victorias-multijugador"
  | "especial";

export type Logro = {
  id: string;
  categoria: CategoriaLogro;
  tier: TierLogro;
  nombre: string;
  descripcion: string;
  /** El número que hay que alcanzar en el contador de esa categoría. */
  umbral: number;
};

// Escala de recompensa por tier -- "media" a propósito (ni tan plana que
// el legendario se sienta igual que el bronce, ni tan bestia que un
// logro fácil dé una fracción ridícula comparado con el difícil).
// Reutilizada literalmente para todos los logros, incluidos los
// "especiales" (cada uno usa el tier que mejor representa su dificultad
// real, aunque no formen una progresión con otros logros de su mismo
// nombre).
export const EXP_POR_TIER: Record<TierLogro, number> = {
  bronce: 25,
  plata: 50,
  oro: 90,
  esmeralda: 150,
  zafiro: 220,
  amatista: 300,
  rubi: 380,
  legendario: 500,
};

// Orden de tiers, para pintar la escala de color/recompensa de forma
// consistente en cualquier sitio que necesite "el tier anterior/siguiente".
export const ORDEN_TIERS: TierLogro[] = [
  "bronce", "plata", "oro", "esmeralda", "zafiro", "amatista", "rubi", "legendario",
];

// Nombre de icono de lucide-react por CATEGORÍA -- un solo icono por
// temática, tal y como se decidió (07/08/2026): lo que distingue un tier
// de otro es el COLOR (EXP_POR_TIER/ORDEN_TIERS de arriba), no el dibujo.
// Guardado como string (no como el componente en sí) para que este
// archivo pueda importarse también desde el servidor sin arrastrar
// react/lucide -- el mapeo string -> componente vive en
// LogroInsignia.tsx, que es "use client".
export const ICONO_POR_CATEGORIA: Record<CategoriaLogro, string> = {
  nivel: "Star",
  amigos: "UserPlus",
  "multijugador-jugadas": "Swords",
  "victorias-grid": "Grid3x3",
  "victorias-top10": "ListOrdered",
  dificil: "Flame",
  racha: "Zap",
  "victorias-multijugador": "Target",
  especial: "Trophy", // los especiales pisan este icono por defecto con `icono` propio si hace falta, ver LOGROS
};

// Nombre visible de cada categoría, para agrupar la pantalla de Logros.
export const NOMBRE_CATEGORIA: Record<CategoriaLogro, string> = {
  nivel: "Nivel",
  amigos: "Amigos",
  "multijugador-jugadas": "Partidas con amigos",
  "victorias-grid": "Victorias en 3x3",
  "victorias-top10": "Victorias en Top 10",
  dificil: "Maestría en difícil",
  racha: "Rachas",
  "victorias-multijugador": "Victorias multijugador",
  especial: "Especiales",
};

export const LOGROS: Logro[] = [
  // ── Nivel (8) ──────────────────────────────────────────────
  { id: "nivel-1", categoria: "nivel", tier: "bronce", nombre: "Primeros pasos", descripcion: "Alcanza el nivel 1.", umbral: 1 },
  { id: "nivel-5", categoria: "nivel", tier: "plata", nombre: "Cogiendo ritmo", descripcion: "Alcanza el nivel 5.", umbral: 5 },
  { id: "nivel-10", categoria: "nivel", tier: "oro", nombre: "Habitual", descripcion: "Alcanza el nivel 10.", umbral: 10 },
  { id: "nivel-15", categoria: "nivel", tier: "esmeralda", nombre: "En racha", descripcion: "Alcanza el nivel 15.", umbral: 15 },
  { id: "nivel-20", categoria: "nivel", tier: "zafiro", nombre: "Veterano", descripcion: "Alcanza el nivel 20.", umbral: 20 },
  { id: "nivel-30", categoria: "nivel", tier: "amatista", nombre: "Experto", descripcion: "Alcanza el nivel 30.", umbral: 30 },
  { id: "nivel-40", categoria: "nivel", tier: "rubi", nombre: "Élite", descripcion: "Alcanza el nivel 40.", umbral: 40 },
  { id: "nivel-50", categoria: "nivel", tier: "legendario", nombre: "Leyenda de Goal Arena", descripcion: "Alcanza el nivel 50.", umbral: 50 },

  // ── Amigos (2) ─────────────────────────────────────────────
  { id: "amigos-1", categoria: "amigos", tier: "bronce", nombre: "No estás solo", descripcion: "Añade a tu primer amigo.", umbral: 1 },
  { id: "amigos-10", categoria: "amigos", tier: "oro", nombre: "Círculo de amigos", descripcion: "Ten 10 amigos.", umbral: 10 },

  // ── Partidas multijugador jugadas (4) ─────────────────────
  { id: "mp-jugadas-1", categoria: "multijugador-jugadas", tier: "bronce", nombre: "Estreno en sala", descripcion: "Juega tu primera partida multijugador.", umbral: 1 },
  { id: "mp-jugadas-10", categoria: "multijugador-jugadas", tier: "plata", nombre: "Habitual de las salas", descripcion: "Juega 10 partidas multijugador.", umbral: 10 },
  { id: "mp-jugadas-50", categoria: "multijugador-jugadas", tier: "oro", nombre: "Uno de la pandilla", descripcion: "Juega 50 partidas multijugador.", umbral: 50 },
  { id: "mp-jugadas-100", categoria: "multijugador-jugadas", tier: "esmeralda", nombre: "Alma de la fiesta", descripcion: "Juega 100 partidas multijugador.", umbral: 100 },

  // ── Victorias en 3x3 (4) ──────────────────────────────────
  { id: "grid-victorias-10", categoria: "victorias-grid", tier: "bronce", nombre: "Aprendiz del 3x3", descripcion: "Gana 10 partidas de 3x3.", umbral: 10 },
  { id: "grid-victorias-25", categoria: "victorias-grid", tier: "plata", nombre: "Estratega del tablero", descripcion: "Gana 25 partidas de 3x3.", umbral: 25 },
  { id: "grid-victorias-50", categoria: "victorias-grid", tier: "oro", nombre: "Maestro del cruce", descripcion: "Gana 50 partidas de 3x3.", umbral: 50 },
  { id: "grid-victorias-100", categoria: "victorias-grid", tier: "esmeralda", nombre: "Enciclopedia con patas", descripcion: "Gana 100 partidas de 3x3.", umbral: 100 },

  // ── Victorias en Top 10 (4) ───────────────────────────────
  { id: "top10-victorias-10", categoria: "victorias-top10", tier: "bronce", nombre: "Buen ojo", descripcion: "Gana 10 partidas de Top 10.", umbral: 10 },
  { id: "top10-victorias-25", categoria: "victorias-top10", tier: "plata", nombre: "Casi sin mirar la chuleta", descripcion: "Gana 25 partidas de Top 10.", umbral: 25 },
  { id: "top10-victorias-50", categoria: "victorias-top10", tier: "oro", nombre: "Rankings de memoria", descripcion: "Gana 50 partidas de Top 10.", umbral: 50 },
  { id: "top10-victorias-100", categoria: "victorias-top10", tier: "esmeralda", nombre: "El que sabe, sabe", descripcion: "Gana 100 partidas de Top 10.", umbral: 100 },

  // ── Maestría en difícil (2) -- solo 3x3, dificultad difícil ──
  { id: "dificil-10", categoria: "dificil", tier: "oro", nombre: "Nivel elxokas", descripcion: "Gana 10 partidas de 3x3 en dificultad difícil.", umbral: 10 },
  { id: "dificil-25", categoria: "dificil", tier: "rubi", nombre: "Sin red de seguridad", descripcion: "Gana 25 partidas de 3x3 en dificultad difícil.", umbral: 25 },

  // ── Rachas (3) ─────────────────────────────────────────────
  { id: "racha-5", categoria: "racha", tier: "bronce", nombre: "Calentando motores", descripcion: "Consigue una racha de 5 victorias seguidas.", umbral: 5 },
  { id: "racha-10", categoria: "racha", tier: "plata", nombre: "Imparable", descripcion: "Consigue una racha de 10 victorias seguidas.", umbral: 10 },
  { id: "racha-20", categoria: "racha", tier: "oro", nombre: "Nadie te para", descripcion: "Consigue una racha de 20 victorias seguidas.", umbral: 20 },

  // ── Victorias multijugador (2) ─────────────────────────────
  { id: "mp-victorias-1", categoria: "victorias-multijugador", tier: "bronce", nombre: "Competidor", descripcion: "Gana tu primera partida multijugador.", umbral: 1 },
  { id: "mp-victorias-10", categoria: "victorias-multijugador", tier: "esmeralda", nombre: "El que manda en la sala", descripcion: "Gana 10 partidas multijugador.", umbral: 10 },

  // ── Especiales (3) ─────────────────────────────────────────
  { id: "primera-victoria", categoria: "especial", tier: "bronce", nombre: "Primera victoria", descripcion: "Gana tu primera partida, del juego que sea.", umbral: 1 },
  { id: "explorador", categoria: "especial", tier: "plata", nombre: "Explorador", descripcion: "Juega al menos una vez a cada minijuego disponible.", umbral: 1 },
  { id: "cien-no-es-nada", categoria: "especial", tier: "zafiro", nombre: "Cien no es nada", descripcion: "Juega 100 partidas en total, individuales o multijugador.", umbral: 100 },
];

// Icono propio por logro "especial" (no todos comparten el mismo dibujo,
// a diferencia del resto de categorías) -- se consulta aquí en vez de en
// ICONO_POR_CATEGORIA, que para "especial" solo sirve de valor por
// defecto si algún día se añade un especial sin entrada aquí.
export const ICONO_ESPECIAL: Record<string, string> = {
  "primera-victoria": "Trophy",
  explorador: "Compass",
  "cien-no-es-nada": "Medal",
};

export function iconoDeLogro(logro: Logro): string {
  if (logro.categoria === "especial") return ICONO_ESPECIAL[logro.id] ?? ICONO_POR_CATEGORIA.especial;
  return ICONO_POR_CATEGORIA[logro.categoria];
}

// ────────────────────────────────────────────────────────────────
// Tipos de progreso -- definidos aquí (no en progresoLogros.ts, que
// importa Prisma) para que también los pueda usar el cliente sin
// arrastrar nada de servidor.
// ────────────────────────────────────────────────────────────────

export type EstadoLogro = "bloqueado" | "reclamable" | "reclamado";

export type LogroConProgreso = Logro & {
  /** Nunca supera `umbral` -- se recorta aunque el contador real vaya más allá. */
  progreso: number;
  estado: EstadoLogro;
  /** Solo si estado === "reclamado". */
  expGanada?: number;
  reclamadoEn?: string; // ISO
};