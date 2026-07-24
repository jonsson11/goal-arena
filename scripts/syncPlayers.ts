// scripts/syncPlayers.ts
//
// Sincroniza una lista de jugadores desde Wikipedia hacia la base de datos.
// Es idempotente: se puede volver a correr y no duplica etapas (las reemplaza).
//
// Ejecutar con: npx tsx scripts/syncPlayers.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Lista de arranque. Amplíala según necesites para tener contenido de prueba.
const JUGADORES_INICIALES = [
  "Sergio Ramos",
  "Kylian Mbappé",
  "Lionel Messi",
  "Cristiano Ronaldo",
  "Kevin De Bruyne",
];

type StintCrudo = {
  startYear: number;
  endYear: number | null;
  team: string;
  teamTarget: string;
  caps: number;
  goals: number;
};

async function fetchWikitext(nombre: string): Promise<string | null> {
  const url = `https://en.wikipedia.org/w/api.php?action=parse&page=${encodeURIComponent(
    nombre
  )}&prop=wikitext&section=0&format=json&origin=*`;
  const res = await fetch(url);
  const data = await res.json();
  if (data.error) return null;
  return data.parse.wikitext["*"];
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

// "1993|3|18" dentro de {{birth date and age|df=yes|1993|3|18}} -> Date
function parseBirthDate(raw: string | null): Date | null {
  if (!raw) return null;
  const m = raw.match(/(\d{4})\|(\d{1,2})\|(\d{1,2})/);
  if (!m) return null;
  const [, year, month, day] = m;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

// "[[France national football team|France]]" -> "France"
function parseNacionalidad(raw: string | null): string | null {
  if (!raw) return null;
  const club = parseClub(raw);
  if (!club) return null;
  return club.display.replace(/national (under-\d+ )?football team/i, "").trim() || null;
}

function parseYears(raw: string | null): { startYear: number | null; endYear: number | null } {
  if (!raw) return { startYear: null, endYear: null };
  if (!raw.includes("–")) {
    const y = parseInt(raw, 10) || null;
    return { startYear: y, endYear: y };
  }
  const [startPart, endPart] = raw.split("–");
  const startYear = parseInt(startPart, 10) || null;
  const endYear = endPart.trim() ? parseInt(endPart, 10) || null : null; // null = etapa actual
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

    if (!club || !startYear) continue; // etapa incompleta, la saltamos

    etapas.push({ startYear, endYear, team: club.display, teamTarget: club.target, caps, goals });
  }
  return etapas;
}

type DatosPerfil = {
  fechaNacimiento: Date | null;
  nacionalidad: string | null;
  equipoActual: string | null; // nombre del club, para casar con Team
};

function extraerPerfil(wikitext: string): DatosPerfil {
  const infoboxMatch = wikitext.match(/\{\{Infobox football biography([\s\S]*?)\n\}\}/i);
  if (!infoboxMatch) return { fechaNacimiento: null, nacionalidad: null, equipoActual: null };
  const infobox = infoboxMatch[1];

  const fechaNacimiento = parseBirthDate(getField(infobox, "birth_date"));
  const nacionalidad = parseNacionalidad(getField(infobox, "nationalteam1"));
  const currentClubRaw = getField(infobox, "currentclub");
  const equipoActual = currentClubRaw ? parseClub(currentClubRaw)?.display ?? null : null;

  return { fechaNacimiento, nacionalidad, equipoActual };
}

async function findOrCreateTeam(nombre: string) {
  const existente = await prisma.team.findFirst({ where: { nombre } });
  if (existente) return existente;
  return prisma.team.create({
    data: { nombre, pais: "Desconocido" }, // TODO: completar con football-data.org más adelante
  });
}

async function syncJugador(nombreWikipedia: string) {
  console.log(`\n→ Sincronizando ${nombreWikipedia}...`);

  const wikitext = await fetchWikitext(nombreWikipedia);
  if (!wikitext) {
    console.warn(`  ✗ No se encontró página de Wikipedia para "${nombreWikipedia}"`);
    return;
  }

  const etapas = extraerEtapas(wikitext);
  if (etapas.length === 0) {
    console.warn(`  ✗ No se encontraron etapas de club (infobox distinto o incompleto)`);
    return;
  }

  const perfil = extraerPerfil(wikitext);
  const golesTotales = etapas.reduce((sum, e) => sum + e.goals, 0);
  const partidosTotales = etapas.reduce((sum, e) => sum + e.caps, 0);

  const equipoActual = perfil.equipoActual ? await findOrCreateTeam(perfil.equipoActual) : null;

  // Usamos "wiki:<nombre>" como externalId provisional, hasta que integremos
  // football-data.org y podamos usar su id real como externalId.
  const player = await prisma.player.upsert({
    where: { externalId: `wiki:${nombreWikipedia}` },
    update: {
      goles: golesTotales,
      partidos: partidosTotales,
      fechaNacimiento: perfil.fechaNacimiento,
      nacionalidad: perfil.nacionalidad ?? "Desconocida",
      equipoActualId: equipoActual?.id ?? null,
    },
    create: {
      externalId: `wiki:${nombreWikipedia}`,
      nombre: nombreWikipedia,
      fechaNacimiento: perfil.fechaNacimiento,
      nacionalidad: perfil.nacionalidad ?? "Desconocida",
      equipoActualId: equipoActual?.id ?? null,
      goles: golesTotales,
      asistencias: 0, // TODO: no disponible en Wikipedia, pendiente de otra fuente
      partidos: partidosTotales,
      valorDeMercado: 0, // TODO: no disponible en Wikipedia, pendiente de Transfermarkt/API de pago
    },
  });

  // Reemplazamos todas sus etapas para que el script sea idempotente
  // (se puede re-correr tantas veces como quieras sin duplicar datos).
  await prisma.stint.deleteMany({ where: { playerId: player.id } });

  for (const etapa of etapas) {
    const team = await findOrCreateTeam(etapa.team);
    await prisma.stint.create({
      data: {
        playerId: player.id,
        teamId: team.id,
        startDate: new Date(`${etapa.startYear}-07-01`),
        endDate: etapa.endYear ? new Date(`${etapa.endYear}-06-30`) : null,
      },
    });
  }

  console.log(
    `  ✓ ${etapas.length} etapas guardadas (${golesTotales} goles, ${partidosTotales} partidos totales)`
  );
}

async function main() {
  for (const nombre of JUGADORES_INICIALES) {
    await syncJugador(nombre);
    await new Promise((r) => setTimeout(r, 500)); // pequeña pausa, cortesía con la API de Wikipedia
  }
  await prisma.$disconnect();
  console.log("\nSync completo.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});