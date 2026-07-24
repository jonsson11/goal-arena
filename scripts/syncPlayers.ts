// scripts/syncPlayers.ts
//
// Sincroniza una lista de jugadores concreta, escrita a mano.
// Ejecutar con: npx tsx scripts/syncPlayers.ts
 
import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../src/lib/wikipediaSync";
 
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const JUGADORES_INICIALES = [
    "Leo Messi"
];

 
async function main() {
  const fallos: { nombre: string; motivo: string }[] = [];
  const renombrados: { buscado: string; encontrado: string }[] = [];
  let exitos = 0;
 
  for (const nombre of JUGADORES_INICIALES) {
    console.log(`\n→ Sincronizando ${nombre}...`);
    const resultado = await syncJugadorDesdeWikipedia(prisma, nombre);
 
    if (resultado.ok) {
      exitos++;
      if (resultado.renombrado) {
        renombrados.push({ buscado: nombre, encontrado: resultado.nombreUsado });
      }
      const aviso = resultado.renombrado
        ? `  (encontrado como "${resultado.nombreUsado}", revisa que sea correcto)`
        : "";
      console.log(
        `  ✓ ${resultado.etapas} etapas guardadas (${resultado.goles} goles, ${resultado.partidos} partidos totales)${aviso}`
      );
    } else {
      fallos.push({ nombre, motivo: resultado.motivo });
      console.warn(`  ✗ Fallo: ${resultado.motivo}`);
    }
 
    await new Promise((r) => setTimeout(r, 1200));
  }
 
  await prisma.$disconnect();
 
  console.log(`\n=== Resumen ===`);
  console.log(`Sincronizados con éxito: ${exitos}`);
  console.log(`Fallos: ${fallos.length}`);
  console.log(`Renombrados (revisar): ${renombrados.length}`);
 
  // Guardamos fallos y renombrados en ficheros de texto, para no perderlos
  // en el scroll del terminal y poder revisarlos con calma.
  const lineasFallos = fallos.map((f) => `${f.nombre} — ${f.motivo}`).join("\n");
  await writeFile("scripts/sync-fallos.txt", lineasFallos, "utf-8");
 
  const lineasRenombrados = renombrados
    .map((r) => `${r.buscado} -> ${r.encontrado}`)
    .join("\n");
  await writeFile("scripts/sync-renombrados.txt", lineasRenombrados, "utf-8");
 
  console.log(`\nGuardado: scripts/sync-fallos.txt y scripts/sync-renombrados.txt`);
}
 
main().catch((e) => {
  console.error(e);
  process.exit(1);
});