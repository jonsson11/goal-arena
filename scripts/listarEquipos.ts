// scripts/listarEquipos.ts
//
// Escribe todos los equipos de la BD a scripts/equipos-listado.txt,
// ordenados por número de Stints, para poder copiar los nombres exactos
// a EQUIPOS_ELEGIBLES en marcarEquiposElegibles.ts sin adivinar.
// Ejecutar con: npx tsx scripts/listarEquipos.ts

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const RUTA_SALIDA = "scripts/equipos-listado.txt";

async function main() {
  const equipos = await prisma.team.findMany({
    select: {
      nombre: true,
      pais: true,
      _count: { select: { stints: true } },
    },
  });

  equipos.sort((a, b) => b._count.stints - a._count.stints);

  const lineas = [
    `Total de equipos en la BD: ${equipos.length}`,
    "",
    "Stints  País                  Nombre",
    "------  --------------------  --------------------------------",
    ...equipos.map(
      (e) => `${String(e._count.stints).padStart(6)}  ${e.pais.padEnd(20).slice(0, 20)}  ${e.nombre}`
    ),
  ];

  await writeFile(RUTA_SALIDA, lineas.join("\n"), "utf-8");

  console.log(`✓ ${equipos.length} equipos escritos en ${RUTA_SALIDA}`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});