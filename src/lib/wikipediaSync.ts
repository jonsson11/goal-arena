// src/lib/wikipediaSync.ts
//
// Lógica compartida: dado el nombre de un jugador, intenta encontrar su
// página de Wikipedia (con fallback a búsqueda si el nombre exacto no
// existe) y sincroniza su infobox en la base de datos.
// La usan tanto scripts/syncPlayers.ts como scripts/syncSquads.ts.

import type { PrismaClient } from "@prisma/client";

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
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
    titulo
  )}&prop=wikitext&section=0&format=json&origin=*`;

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
  const directo = await fetchWikitextExacto(nombreBuscado);
  if (directo) return { wikitext: directo, tituloUsado: nombreBuscado };

  await esperar(400); // pequeña pausa antes de la búsqueda alternativa

  const alternativo = await buscarTituloAlternativo(nombreBuscado);
  if (!alternativo || alternativo === nombreBuscado) return null;

  await esperar(400);

  const wikitextAlternativo = await fetchWikitextExacto(alternativo);
  if (!wikitextAlternativo) return null;

  return { wikitext: wikitextAlternativo, tituloUsado: alternativo };
}

function getField(infobox: string, campo: string): string | null {
  const re = new RegExp(`\\|\\s*${campo}\\s*=\\s*(.+)`, "i");
  const m = infobox.match(re);
  return m ? m[1].trim().replace(/<!--.*?-->/g, "").trim() : null;
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
  const infoboxMatch = wikitext.match(/\{\{Infobox football biography([\s\S]*?)\n\}\}/i);
  if (!infoboxMatch) return [];
  const infobox = infoboxMatch[1];

  const etapas: StintCrudo[] = [];
  for (let i = 1; i <= 25; i++) {
    const yearsRaw = getField(infobox, `years${i}`);
    const clubsRaw = getField(infobox, `clubs${i}`);
    if (!yearsRaw && !clubsRaw) break;

    const caps = parseInt(getField(infobox, `caps${i}`) ?? "", 10) || 0;
    const goals = parseInt(getField(infobox, `goals${i}`) ?? "", 10) || 0;
    const club = parseClub(clubsRaw);
    const { startYear, endYear } = parseYears(yearsRaw);

    if (!club || !startYear) continue;

    etapas.push({ startYear, endYear, team: club.display, teamTarget: club.target, caps, goals });
  }
  return etapas;
}

type DatosPerfil = {
  fechaNacimiento: Date | null;
  equipoActual: string | null;
};

function extraerPerfil(wikitext: string): DatosPerfil {
  const infoboxMatch = wikitext.match(/\{\{Infobox football biography([\s\S]*?)\n\}\}/i);
  if (!infoboxMatch) return { fechaNacimiento: null, equipoActual: null };
  const infobox = infoboxMatch[1];

  const fechaNacimiento = parseBirthDate(getField(infobox, "birth_date"));
  const currentClubRaw = getField(infobox, "currentclub");
  const equipoActual = currentClubRaw ? parseClub(currentClubRaw)?.display ?? null : null;

  return { fechaNacimiento, equipoActual };
}

async function findOrCreateTeam(prisma: PrismaClient, nombre: string) {
  const existente = await prisma.team.findFirst({ where: { nombre } });
  if (existente) return existente;
  return prisma.team.create({
    data: { nombre, pais: "Desconocido" },
  });
}

export type ResultadoSync =
  | { ok: true; etapas: number; goles: number; partidos: number; nombreUsado: string; renombrado: boolean }
  | { ok: false; motivo: "sin_pagina" | "sin_infobox" | "sin_etapas" };

export async function syncJugadorDesdeWikipedia(
  prisma: PrismaClient,
  nombreBuscado: string
): Promise<ResultadoSync> {
  const encontrado = await fetchWikitextConFallback(nombreBuscado);
  if (!encontrado) return { ok: false, motivo: "sin_pagina" };

  const { wikitext, tituloUsado } = encontrado;

  const etapas = extraerEtapas(wikitext);
  if (etapas.length === 0) return { ok: false, motivo: "sin_etapas" };

  const perfil = extraerPerfil(wikitext);
  const golesTotales = etapas.reduce((sum, e) => sum + e.goals, 0);
  const partidosTotales = etapas.reduce((sum, e) => sum + e.caps, 0);

  const equipoActual = perfil.equipoActual
    ? await findOrCreateTeam(prisma, perfil.equipoActual)
    : null;

  const player = await prisma.player.upsert({
    where: { externalId: `wiki:${tituloUsado}` },
    update: {
      goles: golesTotales,
      partidos: partidosTotales,
      fechaNacimiento: perfil.fechaNacimiento,
      equipoActualId: equipoActual?.id ?? null,
    },
    create: {
      externalId: `wiki:${tituloUsado}`,
      nombre: tituloUsado,
      fechaNacimiento: perfil.fechaNacimiento,
      nacionalidad: "Desconocida",
      equipoActualId: equipoActual?.id ?? null,
      goles: golesTotales,
      asistencias: 0,
      partidos: partidosTotales,
      valorDeMercado: 0,
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
    renombrado: tituloUsado !== nombreBuscado,
  };
}