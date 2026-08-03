// scripts/jugadores/listarJugadoresTop5Ligas.ts
//
// Escribe a un CSV todos los jugadores de la BD que hayan tenido alguna
// etapa (Stint) en un equipo de uno de los 5 países de las "top 5 ligas"
// (España, Inglaterra, Francia, Alemania, Italia) -- pensado para abrir el
// CSV en una hoja de cálculo, cruzarlo contra la plantilla oficial actual
// de cada liga/equipo (ej. la Wikipedia de la temporada en curso, o
// API-Football) y ver de un vistazo qué jugadores conocidos TODAVÍA no
// están en la BD (los que faltan en el CSV pero sí en la plantilla real).
//
// Importante sobre el filtro: Team.pais se rellena con el país real solo
// cuando el sync de Wikipedia lo detecta -- si un equipo se creó sin poder
// determinarlo, se queda en "Desconocido" (ver findOrCreateTeam en
// src/lib/scraping/wikipediaSync.ts) y NO se puede filtrar por país. Este
// script filtra por Team.pais tolerando que esté en español o en inglés
// (ambos aparecen en la BD según de dónde vino el dato), pero un equipo
// "Desconocido" con muchos stints es candidato a ser justo uno de estos 5
// países sin haberlo detectado -- por eso, al final, el script también
// imprime en consola los equipos "Desconocido" con más stints, para que
// puedas revisarlos a mano (y decidir si hace falta un script aparte que
// les ponga el país correcto).
//
// Solo LEE, no escribe nada en la BD -- el único archivo que toca es el
// CSV de salida.
//
// Ejecutar con: npx tsx scripts/jugadores/listarJugadoresTop5Ligas.ts
//
// Requiere en .env: DATABASE_URL.

import "dotenv/config";
import { writeFile, mkdir } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const RUTA_SALIDA = "data/jugadores/jugadores-top5-ligas.csv";

// Cada país de las top 5 ligas, con las variantes de string que puede
// tener guardadas Team.pais (español/inglés, con y sin tilde) -- el sync
// no siempre ha guardado el mismo idioma, así que hay que aceptar varias.
const PAISES_TOP5: { canon: string; variantes: string[] }[] = [
  { canon: "España", variantes: ["España", "Espana", "Spain"] },
  { canon: "Inglaterra", variantes: ["Inglaterra", "England"] },
  { canon: "Francia", variantes: ["Francia", "France"] },
  { canon: "Alemania", variantes: ["Alemania", "Germany"] },
  { canon: "Italia", variantes: ["Italia", "Italy"] },
];

const VARIANTE_A_CANON = new Map<string, string>();
for (const { canon, variantes } of PAISES_TOP5) {
  for (const v of variantes) VARIANTE_A_CANON.set(v.toLowerCase(), canon);
}

function paisCanonico(paisEnBD: string): string | null {
  return VARIANTE_A_CANON.get(paisEnBD.trim().toLowerCase()) ?? null;
}

// Escapa un campo para CSV: si lleva coma, comilla o salto de línea, lo
// envuelve en comillas dobles (duplicando las comillas internas).
function celdaCSV(valor: string): string {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

async function main() {
  console.log("Buscando jugadores con alguna etapa en equipos de las top 5 ligas...\n");

  const variantesTodas = PAISES_TOP5.flatMap((p) => p.variantes);

  const jugadores = await prisma.player.findMany({
    where: {
      stints: {
        some: {
          team: { pais: { in: variantesTodas, mode: "insensitive" } },
        },
      },
    },
    select: {
      id: true,
      nombre: true,
      nacionalidad: true,
      stints: {
        select: { team: { select: { nombre: true, pais: true, elegibleParaGrid: true } } },
        orderBy: { startDate: "asc" },
      },
    },
    orderBy: { nombre: "asc" },
  });

  console.log(`${jugadores.length} jugadores encontrados.\n`);

  const filas = [["nombre", "nacionalidad", "equipos_top5", "paises_top5", "total_etapas_top5", "algun_equipo_elegible"]];

  for (const jugador of jugadores) {
    const stintsTop5 = jugador.stints
      .map((s) => ({ ...s, paisCanon: paisCanonico(s.team.pais) }))
      .filter((s) => s.paisCanon !== null);

    const equipos = [...new Set(stintsTop5.map((s) => s.team.nombre))].join("; ");
    const paises = [...new Set(stintsTop5.map((s) => s.paisCanon))].join("; ");
    const algunElegible = stintsTop5.some((s) => s.team.elegibleParaGrid) ? "sí" : "no";

    filas.push([
      jugador.nombre,
      jugador.nacionalidad,
      equipos,
      paises,
      String(stintsTop5.length),
      algunElegible,
    ]);
  }

  const csv = filas.map((fila) => fila.map(celdaCSV).join(",")).join("\n");

  await mkdir("data/jugadores", { recursive: true });
  await writeFile(RUTA_SALIDA, csv, "utf-8");

  console.log(`✓ CSV escrito en ${RUTA_SALIDA} (${jugadores.length} jugadores).`);

  // --- Aviso de equipos "Desconocido" con muchos stints: candidatos a ser
  // justo un club de las top 5 ligas que se coló sin país detectado, y que
  // por tanto este listado se está perdiendo.
  const equiposDesconocidos = await prisma.team.findMany({
    where: { pais: "Desconocido" },
    select: { nombre: true, _count: { select: { stints: true } } },
  });

  const relevantes = equiposDesconocidos
    .filter((e) => e._count.stints > 0)
    .sort((a, b) => b._count.stints - a._count.stints)
    .slice(0, 20);

  if (relevantes.length > 0) {
    console.log(`\n⚠️  ${equiposDesconocidos.length} equipo(s) en la BD con país "Desconocido".`);
    console.log(`Los ${relevantes.length} con más stints (revisa si alguno es en realidad de las top 5 ligas):\n`);
    for (const e of relevantes) {
      console.log(`  ${String(e._count.stints).padStart(4)} stints  ${e.nombre}`);
    }
    console.log(
      "\nSi alguno de estos SÍ es un club de las top 5 ligas, sus jugadores no están saliendo en el CSV " +
        "de arriba -- hay que corregirle el país en la BD (a mano, o con un pequeño script de update)."
    );
  }

  await prisma.$disconnect();
}

main().catch(async (e: unknown) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});