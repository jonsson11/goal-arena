// scripts/jugadores/verStintsJugador.ts
//
// Dado el id de un Player, imprime sus etapas (Stint) de forma legible:
// equipo, país, fechas y si fue su etapa actual (sin endDate).
// Ejecutar con: npx tsx scripts/jugadores/verStintsJugador.ts <id>
//
// Ejemplo: npx tsx scripts/jugadores/verStintsJugador.ts cms2xgz0x00v7ygduoxethr7f

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function formatearFecha(fecha: Date | null): string {
  if (!fecha) return "actualidad";
  return fecha.toISOString().split("T")[0];
}

async function main() {
  const id = process.argv[2];

  if (!id) {
    console.error("Uso: npx tsx scripts/jugadores/verStintsJugador.ts <id-del-jugador>");
    process.exit(1);
  }

  const jugador = await prisma.player.findUnique({
    where: { id },
    include: {
      stints: {
        include: { team: true },
        orderBy: { startDate: "asc" },
      },
    },
  });

  if (!jugador) {
    console.error(`No existe ningún jugador con id "${id}"`);
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`\n${jugador.nombre}`);
  console.log(`  Nacionalidad: ${jugador.nacionalidad}`);
  console.log(`  ${jugador.stints.length} etapa${jugador.stints.length === 1 ? "" : "s"} registrada${jugador.stints.length === 1 ? "" : "s"}:\n`);

  if (jugador.stints.length === 0) {
    console.log("  (sin etapas)");
  }

  for (const stint of jugador.stints) {
    const rango = `${formatearFecha(stint.startDate)} → ${formatearFecha(stint.endDate)}`;
    console.log(`  • ${stint.team.nombre.padEnd(30)} (${stint.team.pais})  ${rango}`);
  }

  console.log();
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});