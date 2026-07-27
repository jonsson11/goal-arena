// scripts/limpiarNacionalidadesJuveniles.ts
//
// Recorre todos los jugadores ya guardados y limpia sufijos de categoría
// juvenil/olímpica en `nacionalidad` (ej. "Italy U20" -> "Italy"), usando
// la misma lógica que ahora aplica el sync a los jugadores nuevos.
// Ejecutar con: npx tsx scripts/limpiarNacionalidadesJuveniles.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { limpiarNombreSeleccion } from "../src/lib/limpiarNombreSeleccion";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const jugadores = await prisma.player.findMany({
    select: { id: true, nombre: true, nacionalidad: true },
  });

  let corregidos = 0;

  for (const jugador of jugadores) {
    const limpio = limpiarNombreSeleccion(jugador.nacionalidad);
    if (limpio !== jugador.nacionalidad) {
      console.log(`  ${jugador.nombre}: "${jugador.nacionalidad}" -> "${limpio}"`);
      await prisma.player.update({ where: { id: jugador.id }, data: { nacionalidad: limpio } });
      corregidos++;
    }
  }

  console.log(`\nCorregidos: ${corregidos} de ${jugadores.length} jugadores.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});