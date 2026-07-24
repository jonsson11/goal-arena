// scripts/fetchSquadNames.ts
//
// Solo habla con API-Football. Busca una liga, sus equipos, y las plantillas.
// Al final imprime la lista de nombres únicos, lista para copiar y pegar
// dentro de JUGADORES_INICIALES en scripts/syncPlayers.ts.
//
// No toca la base de datos ni Wikipedia — así, si algo falla a mitad,
// no dependes de que el proceso entero termine bien.
//
// Ejecutar con: npx tsx scripts/fetchSquadNames.ts

import "dotenv/config";
import { writeFile } from "node:fs/promises";

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

const LIGA_NOMBRE = "La Liga";
const LIGA_PAIS = "Spain";
const TEMPORADA = 2024; // el free tier solo da acceso a 2022-2024

// El free tier de API-Football limita también por minuto, no solo 100/día.
// 7s entre peticiones nos deja tranquilos por debajo de ese límite.
const PAUSA_MS = 7000;
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

  console.log(`\n=== ${LIGA_NOMBRE} (temporada ${TEMPORADA}) ===\n`);

  const ligaId = await obtenerIdLiga();
  await esperar(PAUSA_MS);
  if (!ligaId) {
    console.error("No se encontró la liga. Revisa LIGA_NOMBRE/LIGA_PAIS.");
    process.exit(1);
  }

  const equipos = await obtenerEquipos(ligaId);
  await esperar(PAUSA_MS);
  if (equipos.length === 0) {
    console.error(`No se encontraron equipos para la temporada ${TEMPORADA}.`);
    process.exit(1);
  }

  const nombresUnicos = new Set<string>();
  for (const equipo of equipos) {
    console.log(`Plantilla de ${equipo.name}...`);
    const nombres = await obtenerPlantilla(equipo.id);
    nombres.forEach((n) => nombresUnicos.add(n));
    await esperar(PAUSA_MS);
  }

  const lista = [...nombresUnicos];
  console.log(`\n${lista.length} jugadores únicos encontrados.\n`);

  // Los dejamos también en un fichero, por si el terminal corta la salida
  const nombreFichero = `scripts/squad-names-${LIGA_NOMBRE.toLowerCase().replace(/\s+/g, "-")}.json`;
  await writeFile(nombreFichero, JSON.stringify(lista, null, 2), "utf-8");
  console.log(`Guardado también en: ${nombreFichero}\n`);

  console.log("Copia esto dentro de JUGADORES_INICIALES en scripts/syncPlayers.ts:\n");
  console.log("[");
  lista.forEach((n) => console.log(`  "${n}",`));
  console.log("]");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});