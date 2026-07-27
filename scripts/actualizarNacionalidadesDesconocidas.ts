// scripts/actualizarNacionalidadesDesconocidas.ts
//
// Re-sincroniza contra Wikipedia + Wikidata a todos los jugadores que
// ahora mismo tienen nacionalidad = "Desconocida". Muchos se guardaron
// así antes de los últimos arreglos -- este script les da una segunda
// oportunidad con la lógica actual.
// Ejecutar con: npx tsx scripts/actualizarNacionalidadesDesconocidas.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../src/lib/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Reconstruye la URL de Wikipedia a partir del externalId guardado
// (formato "wiki:<Título con espacios>"), para reutilizar la rama de
// "URL manual" de syncJugadorDesdeWikipedia -- misma lógica que el
// sync normal, sin duplicar nada.
function urlDesdeExternalId(externalId: string): string | null {
  if (!externalId.startsWith("wiki:")) return null;
  const titulo = externalId.slice("wiki:".length);
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(titulo.replace(/ /g, "_"))}`;
}

async function main() {
  const jugadores = await prisma.player.findMany({
    where: { nacionalidad: "Desconocida" },
    select: { id: true, nombre: true, externalId: true },
  });

  console.log(`Jugadores con nacionalidad Desconocida: ${jugadores.length}\n`);

  let resueltos = 0;
  let siguenDesconocidos = 0;
  let fallos = 0;

  for (const jugador of jugadores) {
    if (!jugador.externalId) {
      console.warn(`  ✗ ${jugador.nombre}: sin externalId, no se puede re-sincronizar. Se salta.`);
      fallos++;
      continue;
    }

    const url = urlDesdeExternalId(jugador.externalId);
    if (!url) {
      console.warn(`  ✗ ${jugador.nombre}: externalId "${jugador.externalId}" no tiene formato "wiki:...". Se salta.`);
      fallos++;
      continue;
    }

    console.log(`→ ${jugador.nombre}...`);
    const resultado = await syncJugadorDesdeWikipedia(prisma, jugador.nombre, url);

    if (!resultado.ok) {
      console.warn(`  ✗ Fallo: ${resultado.motivo}`);
      fallos++;
    } else {
      const actualizado = await prisma.player.findUnique({
        where: { id: jugador.id },
        select: { nacionalidad: true },
      });
      if (actualizado?.nacionalidad && actualizado.nacionalidad !== "Desconocida") {
        console.log(`  ✓ Resuelto: ${actualizado.nacionalidad}`);
        resueltos++;
      } else {
        console.log(`  — Sigue Desconocida (dato real no disponible todavía en ninguna fuente)`);
        siguenDesconocidos++;
      }
    }

    await new Promise((r) => setTimeout(r, 1200));
  }

  await prisma.$disconnect();

  console.log(`\n=== Resumen ===`);
  console.log(`Resueltos: ${resueltos}`);
  console.log(`Siguen Desconocida: ${siguenDesconocidos}`);
  console.log(`Fallos (sin externalId válido o error de sync): ${fallos}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});