// scripts/equipos/probarFotosEquipos.ts
//
// Prueba puntual: pide la plantilla de UN equipo y el propio equipo,
// para confirmar si tu plan de API-Football devuelve `photo` (jugador)
// y `logo` (equipo). No toca la BD. Imprime la respuesta completa, sin
// asumir su forma, para poder diagnosticar si algo falla.
// Ejecutar con: npx tsx scripts/equipos/probarFotosEquipos.ts <teamId>

import "dotenv/config";

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

async function main() {
  if (!API_KEY) {
    console.error("Falta API_FOOTBALL_KEY en tu .env");
    process.exit(1);
  }

  const teamId = process.argv[2] ?? "541";

  console.log("=== Petición: /teams ===");
  const resEquipo = await fetch(`${BASE_URL}/teams?id=${teamId}`, {
    headers: { "x-apisports-key": API_KEY },
  });
  console.log("Status HTTP:", resEquipo.status);
  const dataEquipo = await resEquipo.json();
  console.log(JSON.stringify(dataEquipo, null, 2));

  console.log("\n=== Petición: /players/squads ===");
  const resPlantilla = await fetch(`${BASE_URL}/players/squads?team=${teamId}`, {
    headers: { "x-apisports-key": API_KEY },
  });
  console.log("Status HTTP:", resPlantilla.status);
  const dataPlantilla = await resPlantilla.json();
  console.log(JSON.stringify(dataPlantilla, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});