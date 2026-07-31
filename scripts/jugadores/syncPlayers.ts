// scripts/jugadores/syncPlayers.ts
//
// Sincroniza una lista de jugadores concreta, escrita a mano.
// Ejecutar con: npx tsx scripts/jugadores/syncPlayers.ts
//
// Cada entrada de JUGADORES_INICIALES puede ser:
//   - un string con el nombre  -> búsqueda automática con las 4 estrategias
//   - un objeto { nombre, url } -> va directo a esa URL de Wikipedia,
//     sin búsqueda. Usar cuando el nombre no se detecta automáticamente.
//     La URL debe ser de en.wikipedia.org (ver aviso en wikipediaSync.ts).
//
// Antes de sincronizar cada entrada, comprueba si el jugador YA está en
// la BD y, si es así, lo salta sin gastar peticiones de red:
//   - Si la entrada tiene `url`: comprueba por externalId exacto
//     (derivado de esa URL) -- fiable al 100%.
//   - Si la entrada es solo un nombre: comprueba por `nombre` exacto en
//     la BD -- funciona bien en el caso normal, pero si ese jugador se
//     guardó bajo un título distinto al que escribes aquí (por
//     desambiguación), no lo detectará como existente y lo volverá a
//     sincronizar. No hace daño (el upsert lo actualiza, no lo duplica),
//     solo gasta una llamada de más.

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../../src/lib/scraping/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

type EntradaJugador = string | { nombre: string; url: string };

//
//  { nombre: "", url: "" },
const JUGADORES_INICIALES: EntradaJugador[] = [
  {nombre:"Carlos Espí", url:"https://en.wikipedia.org/wiki/Carlos_Esp%C3%AD"}

  ];

// Deriva el externalId ("wiki:Titulo Con Espacios") a partir de una URL
// de en.wikipedia.org, sin tocar wikipediaSync.ts -- misma lógica que
// extraerTituloDeUrlWikipedia allí, duplicada aquí a propósito porque es
// muy pequeña y así no hace falta exportar nada nuevo de ese archivo.
function externalIdDesdeUrl(url: string): string | null {
  const match = url.match(/\/wiki\/([^#?]+)/);
  if (!match) return null;
  const titulo = decodeURIComponent(match[1]).replace(/_/g, " ");
  return `wiki:${titulo}`;
}

async function yaExisteEnBD(entrada: EntradaJugador): Promise<boolean> {
  if (typeof entrada === "string") {
    const existente = await prisma.player.findFirst({ where: { nombre: entrada } });
    return !!existente;
  }

  const externalId = externalIdDesdeUrl(entrada.url);
  if (!externalId) return false;

  const existente = await prisma.player.findUnique({ where: { externalId } });
  return !!existente;
}

async function main() {
  const fallos: { nombre: string; motivo: string }[] = [];
  const renombrados: { buscado: string; encontrado: string }[] = [];
  const saltados: string[] = [];
  let exitos = 0;

  for (const entrada of JUGADORES_INICIALES) {
    const nombre = typeof entrada === "string" ? entrada : entrada.nombre;
    const urlManual = typeof entrada === "string" ? undefined : entrada.url;

    if (await yaExisteEnBD(entrada)) {
      console.log(`\n→ ${nombre}...`);
      console.log(`  — Ya está en la BD, se salta.`);
      saltados.push(nombre);
      continue;
    }

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
  console.log(`Ya existían (saltados): ${saltados.length}`);
  console.log(`Fallos: ${fallos.length}`);
  console.log(`Renombrados (revisar): ${renombrados.length}`);

  const lineasFallos = fallos.map((f) => `${f.nombre} — ${f.motivo}`).join("\n");
  await writeFile("data/jugadores/sync-fallos.txt", lineasFallos, "utf-8");

  const lineasRenombrados = renombrados
    .map((r) => `${r.buscado} -> ${r.encontrado}`)
    .join("\n");
  await writeFile("data/jugadores/sync-renombrados.txt", lineasRenombrados, "utf-8");

  console.log(`\nGuardado: data/jugadores/sync-fallos.txt y data/jugadores/sync-renombrados.txt`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});