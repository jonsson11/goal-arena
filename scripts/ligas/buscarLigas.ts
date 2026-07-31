// scripts/ligas/buscarLigas.ts
//
// Consulta a API-Football qué competiciones existen que coincidan con un
// texto de búsqueda, y para cada una qué temporadas tienes disponibles
// con tu plan actual. Solo lectura -- no toca la BD ni Wikipedia.
//
// Ejecutar con: npx tsx scripts/ligas/buscarLigas.ts "champions"
// (o cualquier otro texto: "premier", "eredivisie", "copa del rey"...)

import "dotenv/config";

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

type Temporada = { year: number; coverage?: { players?: boolean; standings?: boolean } };
type LeagueResult = {
  league: { id: number; name: string; type: string };
  country: { name: string };
  seasons: Temporada[];
};
type ApiFootballLeaguesResponse = { response: LeagueResult[] };

async function main() {
  if (!API_KEY) {
    console.error("Falta API_FOOTBALL_KEY en tu .env");
    process.exit(1);
  }

  const busqueda = process.argv[2];
  if (!busqueda) {
    console.error('Uso: npx tsx scripts/ligas/buscarLigas.ts "texto a buscar"');
    console.error('Ejemplo: npx tsx scripts/ligas/buscarLigas.ts "champions"');
    process.exit(1);
  }

  const res = await fetch(`${BASE_URL}/leagues?search=${encodeURIComponent(busqueda)}`, {
    headers: { "x-apisports-key": API_KEY },
  });
  const data = (await res.json()) as ApiFootballLeaguesResponse & { errors?: Record<string, string> };

  if (data.errors && Object.keys(data.errors).length > 0) {
    console.error("Error de API-Football:", data.errors);
    process.exit(1);
  }

  const resultados = data.response ?? [];

  if (resultados.length === 0) {
    console.log(`Ningún resultado para "${busqueda}".`);
    return;
  }

  console.log(`\n${resultados.length} resultado(s) para "${busqueda}":\n`);

  for (const r of resultados) {
    console.log(`id ${r.league.id} — "${r.league.name}" (${r.league.type}, ${r.country.name})`);

    // Solo las temporadas con "coverage.players" en true tienen datos de
    // plantillas disponibles -- son las únicas que te sirven para
    // fetchSquadNames.ts. Las marco aparte para que no pruebes con una
    // temporada que luego te devuelva la plantilla vacía.
const conJugadores = r.seasons.filter((s) => s.coverage?.players);
    const temporadas = conJugadores.length > 0
      ? conJugadores.map((s) => s.year).join(", ")
      : "(ninguna con datos de plantillas en tu plan)";

    console.log(`  Temporadas con plantillas disponibles: ${temporadas}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});