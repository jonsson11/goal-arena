// scripts/syncPlayers.ts
//
// Sincroniza una lista de jugadores concreta, escrita a mano.
// Ejecutar con: npx tsx scripts/syncPlayers.ts
//
// Cada entrada de JUGADORES_INICIALES puede ser:
//   - un string con el nombre  -> búsqueda automática con las 4 estrategias
//   - un objeto { nombre, url } -> va directo a esa URL de Wikipedia,
//     sin búsqueda. Usar cuando el nombre no se detecta automáticamente.
//     La URL debe ser de en.wikipedia.org (ver aviso en wikipediaSync.ts).

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../src/lib/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type EntradaJugador = string | { nombre: string; url: string };

//
//  { nombre: "", url: "" },
const JUGADORES_INICIALES: EntradaJugador[] = [
{nombre:"Fábio Coentrão", url:"https://en.wikipedia.org/wiki/F%C3%A1bio_Coentr%C3%A3o"}


]

async function main() {
  const fallos: { nombre: string; motivo: string }[] = [];
  const renombrados: { buscado: string; encontrado: string }[] = [];
  let exitos = 0;

  for (const entrada of JUGADORES_INICIALES) {
    const nombre = typeof entrada === "string" ? entrada : entrada.nombre;
    const urlManual = typeof entrada === "string" ? undefined : entrada.url;

    console.log(`\n→ Sincronizando ${nombre}${urlManual ? " (vía URL manual)" : ""}...`);
    const resultado = await syncJugadorDesdeWikipedia(prisma, nombre, urlManual);

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