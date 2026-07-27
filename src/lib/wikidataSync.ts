// src/lib/wikidataSync.ts
//
// Consulta a Wikidata el país que un deportista representa en
// competición, dado el título de su artículo en la Wikipedia en inglés.
// Wikidata es CC0 (dominio público) y su API está pensada explícitamente
// para ser reutilizada por terceros -- a diferencia de Transfermarkt, no
// hay ningún problema de términos de uso aquí.

import { limpiarNombreSeleccion } from "./limpiarNombreSeleccion";


const WIKIDATA_USER_AGENT =
  "GoalArena/0.1 (proyecto personal de aprendizaje; contacto: tu-email@ejemplo.com)";

type ClaimsWikidata = Record<string, { mainsnak?: { datavalue?: { value?: { id?: string } } } }[]>;

async function obtenerEntidadPorTituloWikipedia(
  tituloWikipedia: string
): Promise<{ qid: string; claims: ClaimsWikidata } | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&sites=enwiki&titles=${encodeURIComponent(
    tituloWikipedia
  )}&props=claims&format=json&origin=*`;

  try {
    const res = await fetch(url, { headers: { "User-Agent": WIKIDATA_USER_AGENT } });
    if (!res.ok) return null;

    const data = await res.json();
    const entidades = data?.entities;
    if (!entidades) return null;

    const qid = Object.keys(entidades)[0];
    if (!qid || qid === "-1") return null; // ese artículo no tiene elemento de Wikidata

    return { qid, claims: entidades[qid].claims ?? {} };
  } catch (e) {
    console.warn(`    ⚠ Error de red consultando Wikidata para "${tituloWikipedia}":`, e);
    return null;
  }
}

function primerValorDePropiedad(claims: ClaimsWikidata, propiedad: string): string | null {
  const lista = claims[propiedad];
  if (!lista || lista.length === 0) return null;
  return lista[0].mainsnak?.datavalue?.value?.id ?? null;
}

async function obtenerEtiquetaEnIngles(qid: string): Promise<string | null> {
  const url = `https://www.wikidata.org/w/api.php?action=wbgetentities&ids=${qid}&props=labels&languages=en&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": WIKIDATA_USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    return data?.entities?.[qid]?.labels?.en?.value ?? null;
  } catch {
    return null;
  }
}

/**
 * Devuelve el país que este deportista representa en competición
 * (P1532 "country for sport"), o su ciudadanía (P27) como aproximación
 * si no hay P1532. null si Wikidata no tiene ninguno de los dos.
 */
export async function obtenerNacionalidadWikidata(tituloWikipedia: string): Promise<string | null> {
  const entidad = await obtenerEntidadPorTituloWikipedia(tituloWikipedia);

  if (!entidad) {
    console.warn(`    [wikidata] "${tituloWikipedia}" -> no se encontró elemento de Wikidata para este artículo`);
    return null;
  }

  const p1532 = primerValorDePropiedad(entidad.claims, "P1532");
  const p27 = primerValorDePropiedad(entidad.claims, "P27");
  console.warn(`    [wikidata] "${tituloWikipedia}" -> qid=${entidad.qid} P1532=${p1532 ?? "—"} P27=${p27 ?? "—"}`);

  const qidPais = p1532 ?? p27;
  if (!qidPais) return null;

  const etiqueta = await obtenerEtiquetaEnIngles(qidPais);
  console.warn(`    [wikidata] ${qidPais} -> "${etiqueta ?? "sin etiqueta en inglés"}"`);

  return etiqueta ? limpiarNombreSeleccion(etiqueta) : null;
}