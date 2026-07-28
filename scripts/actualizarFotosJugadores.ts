// scripts/actualizarFotosJugadores.ts
//
// Rellena `imagenUrl` para los jugadores que ya están en la BD y todavía
// no la tienen, pidiendo las imágenes a Wikipedia EN LOTES de 50 (no una
// petición por jugador). Los que no tengan imagen en Wikipedia (o cuyo
// externalId no tenga forma "wiki:...") se listan aparte para revisión
// manual -- no son errores del script, es información real: esa persona
// no tiene foto en su artículo.
// Ejecutar con: npx tsx scripts/actualizarFotosJugadores.ts

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { obtenerImagenesWikipedia } from "../src/lib/wikipediaImagen";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function tituloDesdeExternalId(externalId: string | null): string | null {
  if (!externalId || !externalId.startsWith("wiki:")) return null;
  return externalId.slice("wiki:".length);
}

async function main() {
  const jugadores = await prisma.player.findMany({
    where: { imagenUrl: null },
    select: { id: true, nombre: true, externalId: true },
  });

  console.log(`Jugadores sin imagenUrl: ${jugadores.length}\n`);

  const sinExternalIdValido: string[] = [];
  const conTitulo = jugadores
    .map((j) => ({ jugador: j, titulo: tituloDesdeExternalId(j.externalId) }))
    .filter((entrada) => {
      if (!entrada.titulo) {
        sinExternalIdValido.push(entrada.jugador.nombre);
        return false;
      }
      return true;
    });

  console.log(`Con externalId válido para consultar: ${conTitulo.length}`);
  console.log(`Sin externalId válido (se listan al final, revisar a mano): ${sinExternalIdValido.length}\n`);

  const titulos = conTitulo.map((e) => e.titulo!);
  const mapaImagenes = await obtenerImagenesWikipedia(titulos);

  let actualizados = 0;
  const sinImagenEnWikipedia: string[] = [];

  for (const { jugador, titulo } of conTitulo) {
    const url = mapaImagenes.get(titulo!);

    if (!url) {
      sinImagenEnWikipedia.push(jugador.nombre);
      continue;
    }

    await prisma.player.update({
      where: { id: jugador.id },
      data: { imagenUrl: url },
    });
    actualizados++;
    console.log(`  ✓ ${jugador.nombre}`);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Actualizados con imagen: ${actualizados}`);
  console.log(`Sin imagen en Wikipedia: ${sinImagenEnWikipedia.length}`);
  console.log(`Sin externalId válido: ${sinExternalIdValido.length}`);

  const lineas = [
    "=== Sin imagen en Wikipedia (el artículo existe pero no tiene foto) ===",
    ...sinImagenEnWikipedia,
    "",
    "=== Sin externalId válido (revisar manualmente cómo se sincronizaron) ===",
    ...sinExternalIdValido,
  ].join("\n");

  await writeFile("scripts/fotos-pendientes.txt", lineas, "utf-8");
  console.log(`\nGuardado: scripts/fotos-pendientes.txt`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});