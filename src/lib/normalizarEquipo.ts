// src/lib/normalizarEquipo.ts
//
// Normalización de nombres de club para poder emparejar variantes del
// mismo equipo real: "Real Madrid" con "Real Madrid CF", "Atlético
// Madrid" con "Club Atlético de Madrid", etc.
//
// Antes esta misma lógica vivía duplicada, carácter por carácter, en
// scripts/sync-escudos-equipos.ts y scripts/sync-top-scorers.ts. Se
// centraliza aquí porque, además de esos dos scripts, ahora también la usa
// `findOrCreateTeam` en wikipediaSync.ts -- que era el sitio donde en
// realidad nacían los equipos duplicados en Team: antes comparaba nombres
// con match EXACTO ("Atlético Madrid" !== "Club Atlético de Madrid" como
// strings), así que cada variante que aparecía en una página distinta de
// Wikipedia se creaba como una fila de Team nueva. Ver
// claude/pendientes-goal-arena.md (sesión "equipos duplicados") para el
// contexto completo, y scripts/detectar-equipos-duplicados.ts /
// scripts/fusionar-equipos-duplicados.ts para arreglar los que ya existen.

/** "Ángel Di María" -> "angel di maria" */
export function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Solo siglas y palabras genéricas de forma societaria. Nada que distinga
// a un club de otro: "atletico" o "sociedad" NO van aquí, o "Atlético
// Madrid" y "Real Sociedad" acabarían agrupándose como el mismo equipo.
export const RUIDO_CLUB = new Set([
  "fc", "cf", "rc", "rcd", "cd", "ud", "sd", "ca", "ac", "as", "sc", "sl",
  "sad", "club", "de", "del", "futbol", "football",
]);

/**
 * "Club Atlético de Madrid" -> "atletico madrid"
 * "Real Madrid CF" -> "real madrid"
 *
 * Dos nombres que normalizan al mismo valor se consideran el mismo club
 * real a efectos de emparejamiento (búsqueda en APIs externas, detección
 * de duplicados en la BD...).
 */
export function normalizarEquipo(nombre: string): string {
  return normalizar(nombre)
    .split(" ")
    .filter((p) => p && !RUIDO_CLUB.has(p))
    .join(" ");
}
