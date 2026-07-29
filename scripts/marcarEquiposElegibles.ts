// scripts/marcarEquiposElegibles.ts
//
// Marca como elegibles para el generador del 3x3 los equipos cuyo
// nombre coincida EXACTAMENTE (case-insensitive) con esta lista.
// Ejecutar con: npx tsx scripts/marcarEquiposElegibles.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { EQUIPOS_ELEGIBLES } from "./listaEquiposElegibles";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  let marcados = 0;
  const noEncontrados: string[] = [];

  for (const nombre of EQUIPOS_ELEGIBLES) {
    const resultado = await prisma.team.updateMany({
      where: { nombre: { equals: nombre, mode: "insensitive" } },
      data: { elegibleParaGrid: true },
    });

    if (resultado.count === 0) {
      noEncontrados.push(nombre);
    } else {
      marcados += resultado.count;
      console.log(`  ✓ ${nombre}`);
    }
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Equipos marcados: ${marcados}`);

  if (noEncontrados.length > 0) {
    console.log(`\nNo encontrados en la BD:`);
    noEncontrados.forEach((n) => console.log(`  - ${n}`));
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});