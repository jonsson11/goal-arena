// src/lib/wikipediaSync.ts
//
// Lógica compartida: dado el nombre de un jugador, intenta encontrar su
// página de Wikipedia (con fallback a búsqueda si el nombre exacto no
// existe) y sincroniza su infobox en la base de datos.
// La usan tanto scripts/syncPlayers.ts como scripts/syncSquads.ts.

import type { PrismaClient } from "@prisma/client";

const USER_AGENT = "GoalArena/0.1 (proyecto personal de aprendizaje)";

type StintCrudo = {
  startYear: number;
  endYear: number | null;
  team: string;
  teamTarget: string;
  caps: number;
  goals: number;
};

// Intenta obtener el wikitext de una página EXACTA. Null si no existe o falla.
async function fetchWikitextExacto(titulo: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
    titulo
  )}&prop=wikitext&section=0&format=json&origin=*`;
  try {
    const res = await fetch(url, { headers: { "User-Agent": USER_AGENT } });
    if (!res.ok) return null;
    const data = await res.json();
    if (data.error) return null;
    return data.parse.wikitext["*"];
  } catch {
    return null;
  }
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

// Combina las dos: intenta el nombre exacto, y si falla, prueba con
// el mejor resultado de búsqueda. Devuelve también qué título se usó
// realmente, para no perder esa información.
async function fetchWikitextConFallback(
  nombreBuscado: string
): Promise<{ wikitext: string; tituloUsado: string } | null> {
  const directo = await fetchWikitextExacto(nombreBuscado);
  if (directo) return { wikitext: directo, tituloUsado: nombreBuscado };

  const alternativo = await buscarTituloAlternativo(nombreBuscado);
  if (!alternativo || alternativo === nombreBuscado) return null;

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
    data: { nombre, pais: "Desconocido" }, // TODO: completar con football-data.org más adelante
  });
}

export type ResultadoSync =
  | { ok: true; etapas: number; goles: number; partidos: number; nombreUsado: string; renombrado: boolean }
  | { ok: false; motivo: "sin_pagina" | "sin_infobox" | "sin_etapas" };

/**
 * Sincroniza un jugador desde Wikipedia hacia la base de datos.
 * Si "nombreBuscado" no existe como página exacta, intenta encontrar
 * el título correcto vía búsqueda antes de rendirse.
 * Idempotente: se puede llamar varias veces sin duplicar datos.
 */
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

  // Usamos el título REAL de Wikipedia (tituloUsado), no el nombre buscado,
  // para que dos búsquedas distintas que acaben resolviendo al mismo jugador
  // (ej. "W. Szczęsny" y "Wojciech Szczęsny") no creen dos filas duplicadas.
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
      nacionalidad: "Desconocida", // TODO: pendiente de otra fuente
      equipoActualId: equipoActual?.id ?? null,
      goles: golesTotales,
      asistencias: 0, // TODO: pendiente de otra fuente
      partidos: partidosTotales,
      valorDeMercado: 0, // TODO: pendiente de Transfermarkt/API de pago
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