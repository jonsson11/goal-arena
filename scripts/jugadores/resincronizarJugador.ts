// scripts/jugadores/resincronizarJugador.ts
//
// Re-sincroniza UN jugador que YA existe en la BD y cuyos datos (o
// stints) salieron mal la primera vez -- a diferencia de
// syncPlayers.ts, este script NO se salta al jugador por ya existir:
// al pasarle su `id` directamente, syncJugadorDesdeWikipedia hace el
// upsert sobre ESA fila exacta (mismo id de siempre), así que:
//
//   - Cualquier tabla que le apunte por playerId (Top10Entry, etc.) no
//     necesita ningún cambio -- el id no cambia.
//   - Sus Stint se borran y se vuelven a crear desde cero a partir del
//     wikitext actual (ver deleteMany + create en wikipediaSync.ts),
//     así que un stint mal importado la primera vez queda corregido,
//     no duplicado.
//
// Uso: npx tsx scripts/jugadores/resincronizarJugador.ts "<nombre>" "<url wikipedia opcional>"
//
// Ejemplos:
//   npx tsx scripts/jugadores/resincronizarJugador.ts "Pepe"
//   npx tsx scripts/jugadores/resincronizarJugador.ts "Pepe" "https://en.wikipedia.org/wiki/Pepe_(footballer,_born_1983)"
//
// Si no pasas URL, busca por nombre exacto en la BD para encontrar el
// jugador a corregir, y usa las mismas 4 estrategias de búsqueda
// automática que syncPlayers.ts para encontrar la página de Wikipedia.
// Si el nombre es ambiguo (varios "Pepe" reales), pasa también la URL
// para no dejarlo a la suerte de la búsqueda automática.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../../src/lib/scraping/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

async function main() {
  const [nombre, urlManual] = process.argv.slice(2);

  if (!nombre) {
    console.error(
      'Uso: npx tsx scripts/jugadores/resincronizarJugador.ts "<nombre>" "<url wikipedia opcional>"'
    );
    process.exit(1);
  }

  const existente = await prisma.player.findFirst({ where: { nombre } });

  if (!existente) {
    console.error(
      `No se ha encontrado ningún jugador con nombre exacto "${nombre}" en la BD. Revisa cómo está guardado (Player.nombre) antes de reintentar.`
    );
    await prisma.$disconnect();
    process.exit(1);
  }

  console.log(`Encontrado: ${existente.nombre} (id=${existente.id}, externalId=${existente.externalId}).`);
  console.log(`Re-sincronizando${urlManual ? ` desde ${urlManual}` : " con búsqueda automática"}...`);

  const resultado = await syncJugadorDesdeWikipedia(prisma, nombre, urlManual, existente.id);

  if (resultado.ok) {
    console.log(
      `✓ Corregido: ${resultado.etapas} etapas guardadas (${resultado.goles} goles, ${resultado.partidos} partidos totales).`
    );
    if (resultado.renombrado) {
      console.log(`  (nota: encontrado en Wikipedia como "${resultado.nombreUsado}")`);
    }
  } else {
    console.error(`✗ Fallo: ${resultado.motivo}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});