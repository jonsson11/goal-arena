// scripts/syncSquads.ts
//
// 1. Busca una liga por nombre en API-Football y sus equipos de esa temporada.
// 2. Pide la plantilla de cada equipo.
// 3. Sincroniza cada jugador desde Wikipedia (misma lógica que syncPlayers.ts).
//
// Ejecutar con: npx tsx scripts/syncSquads.ts
//
// Requiere API_FOOTBALL_KEY en tu .env (gratis en api-sports.io, sin tarjeta)

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../src/lib/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

// Cambia esto para sincronizar otra liga. El script busca el id automáticamente,
// no hace falta que sepas el número de antemano.
const LIGA_NOMBRE = "La Liga";
const LIGA_PAIS = "Spain";

// Año de INICIO de la temporada (ej. 2025 = temporada 2025-26).
// Si sale "0 equipos", prueba bajando un año: puede que la temporada nueva
// todavía no tenga plantillas cargadas en la API.
const TEMPORADA = 2024;

// Free tier: 100 peticiones/día (se resetea a las 00:00 UTC). Nos paramos en 90
// por margen de seguridad, y dejamos una pequeña pausa entre llamadas por cortesía.
const LIMITE_PETICIONES = 90;
const PAUSA_MS = 700;
function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

let peticionesUsadas = 0;

async function fetchApiFootball(path: string) {
  peticionesUsadas++;
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": API_KEY! },
  });
  const data = await res.json();
  if (data.errors && Object.keys(data.errors).length > 0) {
    console.warn(`  ✗ Error de API-Football en ${path}:`, data.errors);
    return null;
  }
  return data;
}

async function obtenerIdLiga(): Promise<number | null> {
  const data = await fetchApiFootball(
    `/leagues?name=${encodeURIComponent(LIGA_NOMBRE)}&country=${encodeURIComponent(LIGA_PAIS)}`
  );
  const liga = data?.response?.[0];
  if (!liga) return null;
  console.log(`  Liga encontrada: ${liga.league.name} (id ${liga.league.id})`);
  return liga.league.id;
}

type ApiFootballTeamsResponse = {
  response: { team: { id: number; name: string } }[];
};

type ApiFootballSquadResponse = {
  response: { players: { name: string }[] }[];
};

async function obtenerEquipos(ligaId: number): Promise<{ id: number; name: string }[]> {
  const data = (await fetchApiFootball(
    `/teams?league=${ligaId}&season=${TEMPORADA}`
  )) as ApiFootballTeamsResponse | null;
  return (data?.response ?? []).map((t) => ({ id: t.team.id, name: t.team.name }));
}

async function obtenerPlantilla(teamId: number): Promise<string[]> {
  const data = (await fetchApiFootball(
    `/players/squads?team=${teamId}`
  )) as ApiFootballSquadResponse | null;
  const squad = data?.response?.[0]?.players ?? [];
  return squad.map((j) => j.name);
}

async function main() {
  if (!API_KEY) {
    console.error("Falta API_FOOTBALL_KEY en tu .env");
    process.exit(1);
  }

  console.log(`\n=== ${LIGA_NOMBRE} (temporada ${TEMPORADA}) ===`);

  const ligaId = await obtenerIdLiga();
  await esperar(PAUSA_MS);
  if (!ligaId) {
    console.error("No se encontró la liga. Revisa LIGA_NOMBRE/LIGA_PAIS.");
    process.exit(1);
  }

  const equipos = await obtenerEquipos(ligaId);
  await esperar(PAUSA_MS);
  if (equipos.length === 0) {
    console.error(`No se encontraron equipos para la temporada ${TEMPORADA}. Prueba bajando el año.`);
    process.exit(1);
  }

  const nombresUnicos = new Set<string>();
  for (const equipo of equipos) {
    if (peticionesUsadas >= LIMITE_PETICIONES) {
      console.warn("\n⚠ Cerca del límite de 100 peticiones/día. Parando aquí por seguridad.");
      break;
    }
    console.log(`  Plantilla de ${equipo.name}...`);
    const nombres = await obtenerPlantilla(equipo.id);
    nombres.forEach((n) => nombresUnicos.add(n));
    await esperar(PAUSA_MS);
  }

  console.log(
    `\n${nombresUnicos.size} jugadores únicos recolectados (${peticionesUsadas} peticiones de API-Football usadas). Empezando sync con Wikipedia...\n`
  );

  const fallos: string[] = [];
  let exitos = 0;

  for (const nombre of nombresUnicos) {
    const resultado = await syncJugadorDesdeWikipedia(prisma, nombre);
    if (resultado.ok) {
      exitos++;
      console.log(`  ✓ ${nombre} (${resultado.etapas} etapas)`);
    } else {
      fallos.push(nombre);
      console.warn(`  ✗ ${nombre} — ${resultado.motivo}`);
    }
    await esperar(300);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Sincronizados con éxito: ${exitos}`);
  console.log(`Fallos (revisar manualmente): ${fallos.length}`);
  if (fallos.length > 0) {
    console.log("\nNombres que fallaron:");
    fallos.forEach((f) => console.log(`  - ${f}`));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});