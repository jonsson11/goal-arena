// scripts/equipos/renombrar-equipos-oficial.ts
//
// Pone en Team.nombre el nombre "oficial" que devuelve API-Football
// (equipoApi.name), para los equipos con elegibleParaGrid=true -- son
// los ÚNICOS que se ven de verdad en pantalla: el 3x3 pinta
// Team.nombre literal en las cabeceras de fila/columna (ver
// src/features/games/grid/indiceEquipos.server.ts +
// generarTablero.server.ts, `Condicion.valor`). El resto de equipos
// (los que solo aparecen en algún Stint pero no son elegibles) no se
// tocan aquí: no se muestran en ningún sitio, así que su ortografía
// exacta solo importaba para agruparlos bien -- eso ya lo resuelve
// normalizarEquipo.ts, no hace falta limpiar esos también.
//
// Por qué API-Football y no escribir 60 y pico nombres a mano: es la
// misma fuente que ya usas para el escudo y el externalId, así que el
// nombre queda consistente con esos datos y no hay que mantener una
// lista de "nombres bonitos" aparte -- si API-Football cambia cómo
// llama a un equipo, re-ejecutar este script lo vuelve a poner al día.
//
// Prioriza buscar por externalId (si ya lo tiene guardado) en vez de
// por nombre: te devuelve exactamente esa fila sin depender de que la
// búsqueda por texto acierte.
//
// Ejecutar con:
//   npx tsx scripts/equipos/renombrar-equipos-oficial.ts             (dry-run, no escribe nada)
//   npx tsx scripts/equipos/renombrar-equipos-oficial.ts --aplicar    (aplica los cambios de verdad)
//
// Requiere en .env: DATABASE_URL y API_FOOTBALL_KEY.
// Respeta el límite de 10 peticiones/minuto de API-Football (misma
// pausa que sync-escudos-equipos.ts).

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";
const APLICAR = process.argv.includes("--aplicar");
const PAUSA_MS = 6500;

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type ApiFootballTeam = { id: number; name: string };
type ApiFootballTeamsResponse = {
  errors?: Record<string, string> | unknown[];
  response: { team: ApiFootballTeam }[];
};

async function buscarPorId(externalId: string): Promise<ApiFootballTeam | null> {
  const res = await fetch(`${BASE_URL}/teams?id=${externalId}`, {
    headers: { "x-apisports-key": API_KEY! },
  });
  const data = (await res.json()) as ApiFootballTeamsResponse;
  return data?.response?.[0]?.team ?? null;
}

async function buscarPorNombre(nombre: string): Promise<ApiFootballTeam | null> {
  const res = await fetch(`${BASE_URL}/teams?search=${encodeURIComponent(nombre)}`, {
    headers: { "x-apisports-key": API_KEY! },
  });
  const data = (await res.json()) as ApiFootballTeamsResponse;
  return data?.response?.[0]?.team ?? null;
}

async function main() {
  if (!API_KEY) {
    console.error("Falta API_FOOTBALL_KEY en tu .env");
    process.exit(1);
  }

  console.log(`Modo: ${APLICAR ? "APLICAR (escribe en la BD)" : "dry-run (no escribe nada)"}\n`);

  const equipos = await prisma.team.findMany({
    where: { elegibleParaGrid: true },
    select: { id: true, nombre: true, externalId: true },
  });

  console.log(`${equipos.length} equipo(s) elegibles a revisar.\n`);

  let renombrados = 0;
  let yaCorrectos = 0;
  let sinResultado = 0;

  for (const [i, equipo] of equipos.entries()) {
    process.stdout.write(`[${i + 1}/${equipos.length}] "${equipo.nombre}" ... `);

    const equipoApi = equipo.externalId
      ? await buscarPorId(equipo.externalId)
      : await buscarPorNombre(equipo.nombre);

    if (!equipoApi) {
      console.log("✗ sin resultado en API-Football");
      sinResultado++;
    } else if (equipoApi.name === equipo.nombre) {
      console.log("· ya tiene el nombre oficial");
      yaCorrectos++;
    } else {
      console.log(`→ "${equipoApi.name}"`);
      if (APLICAR) {
        await prisma.team.update({ where: { id: equipo.id }, data: { nombre: equipoApi.name } });
      }
      renombrados++;
    }

    if (i < equipos.length - 1) await esperar(PAUSA_MS);
  }

  console.log("\n=== Resumen ===");
  console.log(`Renombrados${APLICAR ? "" : " (simulados, dry-run)"}: ${renombrados}`);
  console.log(`Ya tenían el nombre oficial: ${yaCorrectos}`);
  console.log(`Sin resultado en API-Football: ${sinResultado}`);
  if (!APLICAR && renombrados > 0) {
    console.log(`\nEsto ha sido un dry-run. Si la lista de arriba tiene buena pinta, vuelve a ejecutar con --aplicar.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
