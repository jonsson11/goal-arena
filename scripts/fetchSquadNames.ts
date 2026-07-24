// scripts/fetchSquadNames.ts
//
// 1. Habla con API-Football: busca una liga, sus equipos, y las plantillas.
// 2. Para cada nombre recolectado, resuelve el título REAL de Wikipedia
//    (soluciona nombres abreviados tipo "W. Szczęsny" -> "Wojciech Szczęsny",
//    y apodos que chocan con otras páginas tipo "Gavi" -> "Gavi (footballer)").
// 3. Guarda la lista final, ya lista para pegar en JUGADORES_INICIALES.
//
// No toca la base de datos — solo genera la lista de nombres.
//
// Ejecutar con: npx tsx scripts/fetchSquadNames.ts

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { resolverTituloWikipedia } from "../src/lib/wikipediaSync";

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

const LIGA_NOMBRE = "Premier League";
const LIGA_PAIS = "England";
const TEMPORADA = 2024; // el free tier solo da acceso a 2022-2024

// El free tier de API-Football limita también por minuto, no solo 100/día.
const PAUSA_API_FOOTBALL_MS = 7000;
// Pausa entre resoluciones de Wikipedia (más ligera, pero con cortesía)
const PAUSA_WIKIPEDIA_MS = 800;

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ApiFootballLeagueResponse = { response: { league: { id: number; name: string } }[] };
type ApiFootballTeamsResponse = { response: { team: { id: number; name: string } }[] };
type ApiFootballSquadResponse = { response: { players: { name: string }[] }[] };
type ApiFootballResponse =
  | ApiFootballLeagueResponse
  | ApiFootballTeamsResponse
  | ApiFootballSquadResponse;

async function fetchApiFootball(path: string, reintento = 0): Promise<ApiFootballResponse | null> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "x-apisports-key": API_KEY! },
  });
  const data = await res.json();

  if (data.errors && Object.keys(data.errors).length > 0) {
    if (data.errors.rateLimit && reintento < 3) {
      console.warn(`  … límite por minuto alcanzado, esperando 15s y reintentando (${reintento + 1}/3)`);
      await esperar(15000);
      return fetchApiFootball(path, reintento + 1);
    }
    console.warn(`  ✗ Error de API-Football en ${path}:`, data.errors);
    return null;
  }
  return data;
}

async function obtenerIdLiga(): Promise<number | null> {
  const data = (await fetchApiFootball(
    `/leagues?name=${encodeURIComponent(LIGA_NOMBRE)}&country=${encodeURIComponent(LIGA_PAIS)}`
  )) as ApiFootballLeagueResponse | null;
  const liga = data?.response?.[0];
  if (!liga) return null;
  console.log(`Liga encontrada: ${liga.league.name} (id ${liga.league.id})`);
  return liga.league.id;
}

async function obtenerEquipos(ligaId: number): Promise<{ id: number; name: string }[]> {
  const data = (await fetchApiFootball(
    `/teams?league=${ligaId}&season=${TEMPORADA}`
  )) as ApiFootballTeamsResponse | null;
  return (data?.response ?? []).map((t) => ({ id: t.team.id, name: t.team.name }));
}

async function obtenerPlantilla(teamId: number): Promise<string[]> {
  const data = (await fetchApiFootball(`/players/squads?team=${teamId}`)) as ApiFootballSquadResponse | null;
  const squad = data?.response?.[0]?.players ?? [];
  return squad.map((j) => j.name);
}

async function main() {
  if (!API_KEY) {
    console.error("Falta API_FOOTBALL_KEY en tu .env");
    process.exit(1);
  }

  console.log(`\n=== ${LIGA_NOMBRE} (temporada ${TEMPORADA}) — recolectando plantillas ===\n`);

  const ligaId = await obtenerIdLiga();
  await esperar(PAUSA_API_FOOTBALL_MS);
  if (!ligaId) {
    console.error("No se encontró la liga. Revisa LIGA_NOMBRE/LIGA_PAIS.");
    process.exit(1);
  }

  const equipos = await obtenerEquipos(ligaId);
  await esperar(PAUSA_API_FOOTBALL_MS);
  if (equipos.length === 0) {
    console.error(`No se encontraron equipos para la temporada ${TEMPORADA}.`);
    process.exit(1);
  }

  const nombresCrudos = new Set<string>();
  for (const equipo of equipos) {
    console.log(`Plantilla de ${equipo.name}...`);
    const nombres = await obtenerPlantilla(equipo.id);
    nombres.forEach((n) => nombresCrudos.add(n));
    await esperar(PAUSA_API_FOOTBALL_MS);
  }

  console.log(`\n${nombresCrudos.size} nombres en crudo recolectados de API-Football.`);
  console.log(`Resolviendo cada uno contra Wikipedia (esto tarda un poco más)...\n`);

  // Resolvemos cada nombre crudo a su título real de Wikipedia.
  // Usamos un Set en el resultado por si dos nombres distintos (ej. un apodo
  // y el nombre completo) resuelven a la misma persona.
  const nombresResueltos = new Set<string>();
  const noResueltos: string[] = [];

  let i = 0;
  for (const nombreCrudo of nombresCrudos) {
    i++;
    const titulo = await resolverTituloWikipedia(nombreCrudo);
    if (titulo) {
      nombresResueltos.add(titulo);
      const aviso = titulo !== nombreCrudo ? ` (era "${nombreCrudo}")` : "";
      console.log(`  [${i}/${nombresCrudos.size}] ✓ ${titulo}${aviso}`);
    } else {
      noResueltos.push(nombreCrudo);
      console.warn(`  [${i}/${nombresCrudos.size}] ✗ No resuelto: "${nombreCrudo}"`);
    }
    await esperar(PAUSA_WIKIPEDIA_MS);
  }

  const listaFinal = [...nombresResueltos];

  console.log(`\n=== Resumen ===`);
  console.log(`Resueltos: ${listaFinal.length}`);
  console.log(`Sin resolver: ${noResueltos.length}`);

  const slug = LIGA_NOMBRE.toLowerCase().replace(/\s+/g, "-");

  await writeFile(`scripts/squad-names-${slug}.json`, JSON.stringify(listaFinal, null, 2), "utf-8");
  await writeFile(`scripts/squad-names-${slug}-sin-resolver.txt`, noResueltos.join("\n"), "utf-8");

  console.log(`\nGuardado:`);
  console.log(`  scripts/squad-names-${slug}.json (nombres resueltos)`);
  console.log(`  scripts/squad-names-${slug}-sin-resolver.txt (para revisar a mano)`);

  console.log("\nCopia esto dentro de JUGADORES_INICIALES en scripts/syncPlayers.ts:\n");
  console.log("[");
  listaFinal.forEach((n) => console.log(`  "${n}",`));
  console.log("]");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});