// src/lib/scraping/wikipediaSync.ts
//
// Lógica compartida: dado el nombre de un jugador, intenta encontrar su
// página de Wikipedia (con fallback a búsqueda si el nombre exacto no
// existe) y sincroniza su infobox en la base de datos.
// La usan tanto scripts/jugadores/syncPlayers.ts como
// scripts/jugadores/syncSquads.ts.
//
// También admite pasar directamente la URL de Wikipedia del jugador,
// para los casos en los que la búsqueda automática (fetchWikitextConFallback)
// no da con la página correcta. En ese caso se salta las 4 estrategias
// de búsqueda y va directo a esa página.
// IMPORTANTE: el parseo del infobox está hecho para la plantilla
// "Infobox football biography" de la Wikipedia EN INGLÉS. Un link a
// es.wikipedia.org (u otro idioma) no va a parsear bien porque esa
// plantilla tiene otros nombres de campo. Por eso solo se aceptan
// URLs de en.wikipedia.org.
import type { PrismaClient } from "@prisma/client";
import { obtenerNacionalidadWikidata } from "./wikidataSync";
import { limpiarNombreSeleccion } from "../normalizacion/limpiarNombreSeleccion";
import { obtenerImagenWikipedia } from "./wikipediaImagen";
import { normalizarEquipo } from "../normalizacion/normalizarEquipo";

// Wikipedia pide identificarse con contacto real en peticiones automatizadas
// (ver https://meta.wikimedia.org/wiki/User-Agent_policy). Cambia el email
// por el tuyo si quieres cumplir esto del todo — no es obligatorio para
// volumen bajo, pero reduce la posibilidad de que te limiten.
const USER_AGENT = "GoalArena/0.1 (proyecto personal de aprendizaje; contacto: tu-email@ejemplo.com)";

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type StintCrudo = {
  startYear: number;
  endYear: number | null;
  team: string;
  teamTarget: string;
  caps: number;
  goals: number;
};

// Intenta obtener el wikitext de una página EXACTA.
// Distingue entre "la página no existe" (motivo real) y "algo falló en la
// petición" (rate limit, red, etc.) — este segundo caso se reintenta y,
// si persiste, se loguea claramente en vez de esconderse.
async function fetchWikitextExacto(titulo: string, reintento = 0): Promise<string | null> {
  // `redirects=true` es importante: action=parse NO sigue redirecciones por
  // defecto. Con jugadores populares es habitual que el título "corto"
  // (ej. "Rodri") acabe convertido en una página de redirección hacia el
  // título desambiguado (ej. "Rodri (footballer, born 1996)") si con el
  // tiempo aparece otro jugador notable con el mismo nombre -- sin este
  // parámetro, pedir "Rodri" devuelve solo el wikitext del redirect
  // (`#REDIRECT [[...]]`), sin infobox, y el sync falla con "sin_infobox"
  // aunque la página real exista y esté perfectamente accesible un clic
  // más allá. Esto afecta sobre todo a re-sincronizaciones por URL/título
  // guardado (externalId) de jugadores sincronizados hace tiempo, cuyo
  // título en Wikipedia pudo cambiar desde entonces.
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
    titulo
  )}&prop=wikitext&section=0&redirects=true&format=json&origin=*`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
  } catch (e) {
    console.warn(`    ⚠ Error de red pidiendo "${titulo}":`, e);
    return null;
  }

  if (res.status === 429 || res.status >= 500) {
    if (reintento < 3) {
      const espera = 5000 * (reintento + 1);
      console.warn(
        `    … Wikipedia devolvió ${res.status} para "${titulo}", esperando ${espera / 1000}s y reintentando (${reintento + 1}/3)`
      );
      await esperar(espera);
      return fetchWikitextExacto(titulo, reintento + 1);
    }
    console.warn(`    ✗ Wikipedia sigue devolviendo ${res.status} para "${titulo}" tras 3 intentos.`);
    return null;
  }

  if (!res.ok) {
    console.warn(`    ✗ Wikipedia respondió ${res.status} para "${titulo}"`);
    return null;
  }

  let data: { error?: { code?: string; info?: string }; parse?: { wikitext: { "*": string } } };
  try {
    data = await res.json();
  } catch {
    console.warn(`    ✗ Respuesta no-JSON de Wikipedia para "${titulo}" (posible bloqueo/rate-limit)`);
    return null;
  }

  if (data.error) {
    // "missingtitle" = de verdad no existe esa página, es un fallo legítimo y silencioso.
    // Cualquier otro código de error es raro y merece verse en consola.
    if (data.error.code !== "missingtitle") {
      console.warn(`    ✗ Wikipedia devolvió error "${data.error.code}" para "${titulo}": ${data.error.info}`);
    }
    return null;
  }

  return data.parse!.wikitext["*"];
}

// Fallback: busca el título más parecido a "nombre" usando el buscador de
// Wikipedia (útil cuando la fuente da un nombre abreviado tipo "W. Szczęsny"
// en vez de "Wojciech Szczęsny").
async function buscarTituloAlternativo(nombre: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(
    nombre
  )}&limit=1&namespace=0&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    const titulo: string | undefined = data?.[1]?.[0];
    return titulo ?? null;
  } catch {
    return null;
  }
}

async function fetchWikitextConFallback(
  nombreBuscado: string
): Promise<{ wikitext: string; tituloUsado: string } | null> {
  // Estrategia 1: nombre exacto tal cual
  const directo = await fetchWikitextExacto(nombreBuscado);
  if (directo && extraerBloqueInfobox(directo)) {
    return { wikitext: directo, tituloUsado: nombreBuscado };
  }

  await esperar(400);

  // Estrategia 2: "<nombre> (footballer)" — patrón de desambiguación muy
  // común en apodos de una palabra (Gavi, Koke, Antony...) que chocan con
  // el nombre de un lugar, otra persona, etc. en Wikipedia.
  const conDesambiguador = `${nombreBuscado} (footballer)`;
  const wikitextDesambiguado = await fetchWikitextExacto(conDesambiguador);
  if (wikitextDesambiguado && extraerBloqueInfobox(wikitextDesambiguado)) {
    return { wikitext: wikitextDesambiguado, tituloUsado: conDesambiguador };
  }

  await esperar(400);

  // Estrategia 3: búsqueda sesgada añadiendo "footballer" a la query,
  // para que el buscador priorice la página correcta sobre homónimos.
  const tituloSesgado = await buscarTituloAlternativo(`${nombreBuscado} footballer`);
  if (tituloSesgado) {
    await esperar(400);
    const wikitextSesgado = await fetchWikitextExacto(tituloSesgado);
    if (wikitextSesgado && extraerBloqueInfobox(wikitextSesgado)) {
      return { wikitext: wikitextSesgado, tituloUsado: tituloSesgado };
    }
  }

  await esperar(400);

  // Estrategia 4 (último recurso): búsqueda simple, sin sesgo
  const alternativo = await buscarTituloAlternativo(nombreBuscado);
  if (alternativo && alternativo !== nombreBuscado && alternativo !== conDesambiguador) {
    const wikitextAlternativo = await fetchWikitextExacto(alternativo);
    if (wikitextAlternativo && extraerBloqueInfobox(wikitextAlternativo)) {
      return { wikitext: wikitextAlternativo, tituloUsado: alternativo };
    }
  }

  return null;
}

/**
 * Dado un nombre (posiblemente abreviado/apodo), intenta resolver el título
 * REAL del artículo de Wikipedia del futbolista, sin tocar la base de datos.
 * Devuelve null si no se encuentra ninguna página con infobox de fútbol.
 * Útil para limpiar listas de nombres (ej. desde API-Football) antes de
 * pasarlas a syncJugadorDesdeWikipedia.
 */
export async function resolverTituloWikipedia(nombreBuscado: string): Promise<string | null> {
  const resultado = await fetchWikitextConFallback(nombreBuscado);
  return resultado?.tituloUsado ?? null;
}

// Extrae el título de página a partir de una URL de Wikipedia, ej:
// "https://en.wikipedia.org/wiki/Fabinho_(footballer)" -> "Fabinho (footballer)"
// "https://en.wikipedia.org/wiki/Kevin_De_Bruyne" -> "Kevin De Bruyne"
// Devuelve null si la URL no es de en.wikipedia.org o no tiene forma de
// URL de artículo (/wiki/...).
function extraerTituloDeUrlWikipedia(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }

  if (u.hostname !== "en.wikipedia.org") return null;

  const match = u.pathname.match(/^\/wiki\/(.+)$/);
  if (!match) return null;

  return decodeURIComponent(match[1]).replace(/_/g, " ");
}

function getField(infobox: string, campo: string): string | null {
  const re = new RegExp(`\\|\\s*${campo}\\s*=\\s*(.+)`, "i");
  const m = infobox.match(re);
  return m ? m[1].trim().replace(/<!--.*?-->/g, "").trim() : null;
}

// Extrae el bloque completo del infobox contando llaves {{ }} manualmente.
// Un regex simple (buscar el primer "}}") falla porque dentro del infobox
// suele haber plantillas anidadas (banderas, enlaces especiales...) que
// también se cierran con "}}" antes de llegar a los campos de club/años,
// cortando la extracción a medias. Contar la profundidad es la única forma
// fiable de encontrar el cierre real.
function extraerBloqueInfobox(wikitext: string): string | null {
  const inicioMatch = wikitext.match(/\{\{Infobox (?:football|soccer) biography/i);
  if (!inicioMatch || inicioMatch.index === undefined) return null;

  const inicio = inicioMatch.index;
  let profundidad = 0;
  let i = inicio;
  const n = wikitext.length;

  while (i < n) {
    if (wikitext.startsWith("{{", i)) {
      profundidad++;
      i += 2;
    } else if (wikitext.startsWith("}}", i)) {
      profundidad--;
      i += 2;
      if (profundidad === 0) return wikitext.slice(inicio, i);
    } else {
      i++;
    }
  }
  return null; // llaves sin balancear (wikitext truncado o malformado)
}

function parseClub(raw: string | null) {
  if (!raw) return null;
  const limpio = raw.replace(/\(loan\)/i, "").replace(/^→\s*/, "").trim();
  const linkMatch = limpio.match(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/);
  if (!linkMatch) return { target: limpio, display: limpio };
  const target = linkMatch[1].trim();
  const display = (linkMatch[2] || linkMatch[1]).trim();
  return { target, display };
}

function parseBirthDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})\|(\d{1,2})\|(\d{1,2})/);
  if (!m) return null;
  const [, year, month, day] = m;
  return new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
}

function parseYears(raw: string | null): { startYear: number | null; endYear: number | null } {
  if (!raw) return { startYear: null, endYear: null };
  if (!raw.includes("–")) {
    const y = parseInt(raw, 10) || null;
    return { startYear: y, endYear: y };
  }
  const [startPart, endPart] = raw.split("–");
  const startYear = parseInt(startPart, 10) || null;
  const endYear = endPart.trim() ? parseInt(endPart, 10) || null : null;
  return { startYear, endYear };
}

function extraerEtapas(wikitext: string): StintCrudo[] {
  const infobox = extraerBloqueInfobox(wikitext);
  if (!infobox) return [];

  const etapas: StintCrudo[] = [];
  for (let i = 1; i <= 25; i++) {
    const yearsRaw = getField(infobox, `years${i}`);
    const clubsRaw = getField(infobox, `clubs${i}`);
    if (!yearsRaw && !clubsRaw) continue;

    const caps = parseInt(getField(infobox, `caps${i}`) ?? "", 10) || 0;
    const goals = parseInt(getField(infobox, `goals${i}`) ?? "", 10) || 0;
    const club = parseClub(clubsRaw);
    const { startYear, endYear } = parseYears(yearsRaw);

    if (!club || !startYear) continue;

    etapas.push({ startYear, endYear, team: club.display, teamTarget: club.target, caps, goals });
  }
  return etapas;
}

// Fallback cuando no hay ninguna selección en el infobox: parte el campo
// birth_place por comas y coge la última parte, que en el patrón habitual
// "[[Ciudad]], País" o "[[Ciudad]], [[País]]" corresponde al país -- esté
// o no enlazado (Wikipedia no siempre enlaza el país). Sin ninguna coma
// (ej. "[[Turin]]" a secas) no hay forma fiable de distinguir "es una
// ciudad" de "es un país", así que en ese caso se devuelve null en vez
// de arriesgarse a adivinar mal.
function paisDesdeBirthPlace(raw: string | null): string | null {
  if (!raw) return null;

  const partes = raw.split(",").map((p) => p.trim());
  if (partes.length < 2) return null;

  const ultima = partes[partes.length - 1];
  const linkMatch = ultima.match(/^\[\[([^\]|]+)(?:\|([^\]]+))?\]\]$/);
  if (linkMatch) return (linkMatch[2] || linkMatch[1]).trim();

  return ultima || null;
}

// Recorre nationalteam1, nationalteam2... y se queda con la ÚLTIMA
// selección encontrada, asumiendo el orden habitual del infobox
// (juveniles primero, absoluta al final). Heurística, no infalible:
// revisa a mano casos de doble nacionalidad o jugadores sin selección
// absoluta.
// Sustituye la función entera por esta versión con logs:
function extraerNacionalidad(infobox: string): string | null {
  let ultimaSeleccion: string | null = null;

  for (let i = 1; i <= 10; i++) {
    const raw = getField(infobox, `nationalteam${i}`);
    if (!raw) continue;
    const equipo = parseClub(raw);
    if (equipo) ultimaSeleccion = limpiarNombreSeleccion(equipo.display);
  }

  if (ultimaSeleccion) return ultimaSeleccion;

  const birthPlaceRaw = getField(infobox, "birth_place");
  return paisDesdeBirthPlace(birthPlaceRaw);
}

type DatosPerfil = {
  fechaNacimiento: Date | null;
  equipoActual: string | null;
  nacionalidad: string;
};

function extraerPerfil(wikitext: string): DatosPerfil {
  const infobox = extraerBloqueInfobox(wikitext);
  if (!infobox) return { fechaNacimiento: null, equipoActual: null, nacionalidad: "Desconocida" };

  const fechaNacimiento = parseBirthDate(getField(infobox, "birth_date"));
  const currentClubRaw = getField(infobox, "currentclub");
  const equipoActual = currentClubRaw ? parseClub(currentClubRaw)?.display ?? null : null;
  const nacionalidad = extraerNacionalidad(infobox) ?? "Desconocida";

  return { fechaNacimiento, equipoActual, nacionalidad };
}

// Caché en memoria (por proceso) de equipos ya vistos, indexado por nombre
// NORMALIZADO -- no por el nombre tal cual. Antes esta función hacía
// `findFirst({ where: { nombre } })`, un match EXACTO de string: como el
// nombre de cada etapa viene del parseo del infobox de Wikipedia y esa
// misma club aparece escrita de formas distintas según la página
// ("Atlético Madrid" en una, "Club Atlético de Madrid" en otra), cada
// variante acababa creando su PROPIA fila de Team -- el jugador A quedaba
// enlazado a un id de Team y el jugador B a otro, aunque fuera el mismo
// club real. Ver claude/pendientes-goal-arena.md (sesión "equipos
// duplicados") y scripts/equipos/detectar-equipos-duplicados.ts /
// scripts/equipos/fusionar-equipos-duplicados.ts para arreglar los que ya
// existen en la BD de antes de este cambio.
//
// Se cachea en memoria (en vez de un `findFirst` normalizado por cada
// llamada) porque esta función se invoca una vez por etapa de carrera de
// cada jugador sincronizado -- en un sync de plantilla completa son
// cientos de llamadas, y triaba/recorrer toda la tabla Team en cada una
// sería carísimo. Solo vive mientras dura el proceso de `npx tsx`, así
// que no hay riesgo de que quede desactualizada entre ejecuciones.
let cacheEquipos: Map<string, { id: string; nombre: string }> | null = null;

async function obtenerCacheEquipos(prisma: PrismaClient) {
  if (!cacheEquipos) {
    const equipos = await prisma.team.findMany({ select: { id: true, nombre: true } });
    cacheEquipos = new Map(equipos.map((e) => [normalizarEquipo(e.nombre), e]));
  }
  return cacheEquipos;
}

async function findOrCreateTeam(prisma: PrismaClient, nombre: string) {
  const cache = await obtenerCacheEquipos(prisma);
  const clave = normalizarEquipo(nombre);

  const existente = cache.get(clave);
  if (existente) return existente;

  const creado = await prisma.team.create({
    data: { nombre, pais: "Desconocido" },
  });
  cache.set(clave, creado);
  return creado;
}

// Quita el desambiguador final de un título de Wikipedia, ej:
// "Gavi (footballer)" -> "Gavi"
// "Luiz Júnior (footballer, born 2001)" -> "Luiz Júnior"
// "Jorge Benítez (Paraguayan footballer)" -> "Jorge Benítez"
// Un título sin paréntesis (el caso normal) no cambia.
function limpiarNombreVisible(titulo: string): string {
  return titulo.replace(/\s*\([^)]*\)\s*$/, "").trim();
}

export type ResultadoSync =
  | { ok: true; etapas: number; goles: number; partidos: number; nombreUsado: string; renombrado: boolean }
  | { ok: false; motivo: "sin_pagina" | "sin_infobox" | "sin_etapas" | "url_invalida" };

/**
 * Sincroniza un jugador desde Wikipedia.
 *
 * - Si NO se pasa `urlManual`: usa el nombre para buscar la página, con las
 *   4 estrategias de fallback habituales.
 * - Si se pasa `urlManual`: se salta toda la búsqueda y va directo a esa
 *   página. Solo se aceptan URLs de en.wikipedia.org (ver nota al principio
 *   del archivo sobre por qué). Útil cuando el nombre no se detecta
 *   automáticamente, jugadores con nombres muy distintos a como aparecen
 *   en Wikipedia, etc.
 * - `opciones.omitirNacionalidadEImagen`: si es true, se salta las
 *   peticiones a Wikidata (nacionalidad) y a la API de imágenes de
 *   Wikipedia -- quedan 2 de las 3 peticiones de red por jugador fuera.
 *   La nacionalidad, en ese caso, se queda con lo que ya se pudo sacar del
 *   propio wikitext (extraerNacionalidad/paisDesdeBirthPlace, sin coste de
 *   red extra) en vez del valor más refinado de Wikidata; e `imagenUrl` NO
 *   se toca en absoluto (ni se pisa con null) si el jugador ya existía.
 *   Pensado para tandas de mantenimiento masivas centradas solo en
 *   Stints (ver scripts/jugadores/actualizarStintsTodos.ts), donde
 *   nacionalidad/foto casi nunca cambian y no vale la pena pagar esas 2
 *   peticiones extra por cada uno de miles de jugadores.
 */
export async function syncJugadorDesdeWikipedia(
  prisma: PrismaClient,
  nombreBuscado: string,
  urlManual?: string,
  playerIdExistente?: string,
  opciones?: { omitirNacionalidadEImagen?: boolean }
): Promise<ResultadoSync> {
  let encontrado: { wikitext: string; tituloUsado: string } | null;
  if (urlManual) {
    const tituloDeUrl = extraerTituloDeUrlWikipedia(urlManual);
    if (!tituloDeUrl) {
      console.warn(
        `    ✗ URL no válida (debe ser de en.wikipedia.org con forma /wiki/Titulo): "${urlManual}"`
      );
      return { ok: false, motivo: "url_invalida" };
    }

    const wikitext = await fetchWikitextExacto(tituloDeUrl);

    if (!wikitext) {
      console.warn(
        `    ✗ No se encontró ninguna página en en.wikipedia.org con el título "${tituloDeUrl}" (extraído de la URL). Revisa que la URL siga siendo válida abriéndola en el navegador.`
      );
      return { ok: false, motivo: "sin_pagina" };
    }

    if (!extraerBloqueInfobox(wikitext)) {
      console.warn(
        `    ✗ La página "${tituloDeUrl}" existe pero no se encontró "{{Infobox football biography" en su contenido. Primeros 200 caracteres del wikitext:\n      ${wikitext.slice(0, 200).replace(/\n/g, " ")}`
      );
      return { ok: false, motivo: "sin_infobox" };
    }

    encontrado = { wikitext, tituloUsado: tituloDeUrl };
  } else {
    encontrado = await fetchWikitextConFallback(nombreBuscado);
  }

  if (!encontrado) return { ok: false, motivo: "sin_pagina" };

  const { wikitext, tituloUsado } = encontrado;

  const etapas = extraerEtapas(wikitext);
  if (etapas.length === 0) return { ok: false, motivo: "sin_etapas" };

  const perfil = extraerPerfil(wikitext);
  const omitirExtra = opciones?.omitirNacionalidadEImagen ?? false;
  // Sin `omitirExtra`: comportamiento de siempre, 2 peticiones extra.
  // Con `omitirExtra`: nacionalidadWikidata se queda en null (cae al
  // fallback ya extraído del wikitext, sin red) e imagenUrl se queda en
  // `undefined` (distinto de `null`) para poder detectar más abajo que NO
  // se debe tocar esa columna en el upsert -- ni pisarla con null.
  const nacionalidadWikidata = omitirExtra ? null : await obtenerNacionalidadWikidata(tituloUsado);
  const imagenUrl = omitirExtra ? undefined : await obtenerImagenWikipedia(tituloUsado);
  const nacionalidad = nacionalidadWikidata ?? perfil.nacionalidad;
  const golesTotales = etapas.reduce((sum, e) => sum + e.goals, 0);
  const partidosTotales = etapas.reduce((sum, e) => sum + e.caps, 0);

  const equipoActual = perfil.equipoActual
    ? await findOrCreateTeam(prisma, perfil.equipoActual)
    : null;

  const nombreVisible = limpiarNombreVisible(tituloUsado);

  // Si se omitió la foto, no incluimos la clave `imagenUrl` en el update
  // -- así Prisma no toca esa columna, en vez de pisarla con null/undefined.
  const campoImagenUpdate = imagenUrl !== undefined ? { imagenUrl } : {};

  const player = await prisma.player.upsert({
    where: playerIdExistente ? { id: playerIdExistente } : { externalId: `wiki:${tituloUsado}` },
    update: {
      externalId: `wiki:${tituloUsado}`,
      nombre: nombreVisible,
      goles: golesTotales,
      partidos: partidosTotales,
      fechaNacimiento: perfil.fechaNacimiento,
      equipoActualId: equipoActual?.id ?? null,
      nacionalidad,
      ...campoImagenUpdate,
    },
    create: {
      externalId: `wiki:${tituloUsado}`,
      nombre: nombreVisible,
      fechaNacimiento: perfil.fechaNacimiento,
      nacionalidad,
      equipoActualId: equipoActual?.id ?? null,
      goles: golesTotales,
      asistencias: 0,
      partidos: partidosTotales,
      valorDeMercado: 0,
      imagenUrl: imagenUrl ?? null,
    },
  });

  await prisma.stint.deleteMany({ where: { playerId: player.id } });

  for (const etapa of etapas) {
    const team = await findOrCreateTeam(prisma, etapa.team);
    await prisma.stint.create({
      data: {
        playerId: player.id,
        teamId: team.id,
        startDate: new Date(Date.UTC(etapa.startYear, 6, 1)),
        endDate: etapa.endYear ? new Date(Date.UTC(etapa.endYear, 5, 30)) : null,
      },
    });
  }

  return {
    ok: true,
    etapas: etapas.length,
    goles: golesTotales,
    partidos: partidosTotales,
    nombreUsado: tituloUsado,
    renombrado: urlManual ? false : tituloUsado !== nombreBuscado,
  };
}