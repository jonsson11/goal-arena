// scripts/syncSquads.ts
//
// 1. Pide a football-data.org las plantillas actuales de varias competiciones.
// 2. Por cada jugador de esas plantillas, lo sincroniza desde Wikipedia
//    reutilizando la misma lógica que syncPlayers.ts.
//
// Ejecutar con: npx tsx scripts/syncSquads.ts
//
// Requiere FOOTBALL_DATA_API_KEY en tu .env (gratis en football-data.org/client/register)

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../src/lib/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const BASE_URL = "https://api.football-data.org/v4";

// Competiciones de club cubiertas por el tier gratuito de football-data.org.
// (Dejamos fuera WC/EC: son torneos, no ligas con plantilla estable todo el año)
const COMPETICIONES = ["PD"]

// ["PL", "PD", "BL1", "SA", "FL1", "DED", "PPL", "ELC", "BSA", "CL"];
// Premier League, LaLiga, Bundes, SeriaA, Ligue1, Eredivise, PrimeiraLiga, Championship, Brasileirao, ChampionsLeague.

// El free tier admite 10 peticiones/minuto. Con 6.5s entre llamadas vamos sobrados
// de margen (~9.2/min) sin arriesgarnos a que nos corten.
const PAUSA_MS = 6500;
function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchFootballData(path: string) {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { "X-Auth-Token": API_KEY! },
  });
  if (!res.ok) {
    console.warn(`  ✗ football-data.org respondió ${res.status} para ${path}`);
    return null;
  }
  return res.json();
}

async function obtenerEquiposDeCompeticion(codigo: string): Promise<{ id: number; name: string }[]> {
  const data = await fetchFootballData(`/competitions/${codigo}/teams`);
  return data?.teams ?? [];
}

async function obtenerPlantilla(teamId: number): Promise<string[]> {
  const data = await fetchFootballData(`/teams/${teamId}`);
  return (data?.squad ?? []).map((j: { name: string }) => j.name);
}

async function main() {
  if (!API_KEY) {
    console.error("Falta FOOTBALL_DATA_API_KEY en tu .env");
    process.exit(1);
  }

  // 1. Recolectamos nombres de todas las plantillas, sin sincronizar todavía.
  //    Usamos un Set para no repetir el mismo jugador si aparece en dos competiciones
  //    (ej. un equipo que juega Champions League Y su liga doméstica).
  const nombresUnicos = new Set<string>();

  for (const codigo of COMPETICIONES) {
    console.log(`\n=== Competición ${codigo} ===`);
    const equipos = await obtenerEquiposDeCompeticion(codigo);
    await esperar(PAUSA_MS);

    for (const equipo of equipos) {
      console.log(`  Plantilla de ${equipo.name}...`);
      const nombres = await obtenerPlantilla(equipo.id);
      nombres.forEach((n) => nombresUnicos.add(n));
      await esperar(PAUSA_MS);
    }
  }

  console.log(`\n${nombresUnicos.size} jugadores únicos recolectados. Empezando sync con Wikipedia...\n`);

  // 2. Sincronizamos cada nombre. Guardamos los que fallen para revisión manual
  //    (nombres que no casan exacto con el título del artículo de Wikipedia).
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
    await esperar(300); // cortesía con la API de Wikipedia (menos estricta que football-data.org)
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