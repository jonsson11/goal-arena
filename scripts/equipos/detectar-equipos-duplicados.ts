// scripts/equipos/detectar-equipos-duplicados.ts
//
// Agrupa todos los Team por nombre normalizado (misma normalización que
// findOrCreateTeam en src/lib/wikipediaSync.ts, ver ese archivo para el
// porqué) y saca a la luz los grupos con más de una fila -- son
// duplicados del mismo club real bajo nombres distintos (p.ej.
// "Atlético Madrid" y "Club Atlético de Madrid"), la causa de que a
// veces falte el escudo en el 3x3, o de que las estadísticas de un
// jugador queden repartidas entre dos ids de Team distintos.
//
// Solo LEE, no escribe nada -- seguro de ejecutar en cualquier momento,
// tantas veces como quieras.
//
// Ejecutar con: npx tsx scripts/equipos/detectar-equipos-duplicados.ts
//
// Requiere en .env: DATABASE_URL.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizarEquipo } from "../../src/lib/normalizacion/normalizarEquipo";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type EquipoFila = {
  id: string;
  nombre: string;
  escudo: string | null;
  externalId: string | null;
  elegibleParaGrid: boolean;
};

// Misma heurística que fusionar-equipos-duplicados.ts: restos crudos de
// la plantilla de infobox de Wikipedia guardados como si fueran nombre
// de equipo, ej. "| clubnumber =". Un club real nunca empieza por "|" ni
// lleva un "=" suelto.
function esNombreBasura(nombre: string): boolean {
  return /^\s*\|/.test(nombre) || nombre.includes("=");
}

async function main() {
  const equipos = await prisma.team.findMany({
    select: { id: true, nombre: true, escudo: true, externalId: true, elegibleParaGrid: true },
  });

  const grupos = new Map<string, EquipoFila[]>();
  for (const equipo of equipos) {
    const clave = normalizarEquipo(equipo.nombre);
    if (!clave) continue; // nombre vacío tras normalizar (raro) -- no agrupa con nada
    const lista = grupos.get(clave) ?? [];
    lista.push(equipo);
    grupos.set(clave, lista);
  }

  const duplicados = [...grupos.entries()].filter(([, lista]) => lista.length > 1);

  if (duplicados.length === 0) {
    console.log("No se han encontrado equipos duplicados por nombre normalizado. 🎉");
    await prisma.$disconnect();
    return;
  }

  console.log(`${duplicados.length} grupo(s) de equipos duplicados encontrados:\n`);

  let totalStints = 0;
  let totalPlayerStats = 0;
  let totalEquipoActual = 0;

  for (const [clave, lista] of duplicados) {
    const esBasura = lista.every((e) => esNombreBasura(e.nombre));
    console.log(`${esBasura ? "🗑" : "—"} "${clave}" (${lista.length} filas)${esBasura ? " -- basura del scrapeo, no un club real" : ""} —`);

    for (const equipo of lista) {
      const [stints, playerStats, equipoActualDe] = await Promise.all([
        prisma.stint.count({ where: { teamId: equipo.id } }),
        prisma.playerStat.count({ where: { teamId: equipo.id } }),
        prisma.player.count({ where: { equipoActualId: equipo.id } }),
      ]);
      totalStints += stints;
      totalPlayerStats += playerStats;
      totalEquipoActual += equipoActualDe;

      console.log(
        `    id=${equipo.id}  "${equipo.nombre}"` +
          `  escudo=${equipo.escudo ? "sí" : "no"}` +
          `  externalId=${equipo.externalId ?? "—"}` +
          `  elegibleParaGrid=${equipo.elegibleParaGrid}` +
          `  stints=${stints}  playerStats=${playerStats}  equipoActualDe=${equipoActualDe}`
      );
    }

    console.log("");
  }

  console.log("=== Resumen ===");
  console.log(`Grupos duplicados: ${duplicados.length}`);
  console.log(`Stints repartidos entre duplicados: ${totalStints}`);
  console.log(`PlayerStat repartidos entre duplicados: ${totalPlayerStats}`);
  console.log(`Jugadores con equipoActual en alguna de estas filas: ${totalEquipoActual}`);
  console.log(
    `\nPara fusionarlos, primero en dry-run (no escribe nada):\n` +
      `  npx tsx scripts/fusionar-equipos-duplicados.ts\n` +
      `y si el plan de salida tiene buena pinta, confírmalo con:\n` +
      `  npx tsx scripts/fusionar-equipos-duplicados.ts --aplicar`
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
