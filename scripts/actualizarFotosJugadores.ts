// scripts/actualizarFotosJugadores.ts
//
// Rellena `imagenUrl` para los jugadores que ya están en la BD y
// todavía no la tienen, usando la REST API de resumen de página de
// Wikipedia (una petición por jugador, con ritmo controlado). A los que
// salen como página de desambiguación se les re-busca el título
// correcto y se actualiza su externalId de paso.
// Ejecutar con: npx tsx scripts/actualizarFotosJugadores.ts

import "dotenv/config";
import { writeFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { obtenerImagenesSecuencial, obtenerImagenWikipedia } from "../src/lib/wikipediaImagen";
import { resolverTituloWikipedia } from "../src/lib/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

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
  console.log(`Esto va a tardar un rato -- una petición por jugador, con pausa entre cada una.\n`);

  const mapaEntrada = new Map(conTitulo.map((e) => [e.titulo!, e]));

  let actualizados = 0;
  const sinImagenReal: string[] = [];
  const recuperadosPorReDesambiguacion: { nombre: string; tituloViejo: string; tituloNuevo: string }[] = [];
  const desambiguacionSinResolver: string[] = [];

  await obtenerImagenesSecuencial(
    conTitulo.map((e) => e.titulo!),
    async (titulo, resultado) => {
      const { jugador } = mapaEntrada.get(titulo)!;

      if (resultado.imagenUrl) {
        await prisma.player.update({ where: { id: jugador.id }, data: { imagenUrl: resultado.imagenUrl } });
        actualizados++;
        console.log(`  ✓ ${jugador.nombre}`);
        return;
      }

      if (resultado.esDesambiguacion) {
        console.log(`  … "${jugador.nombre}" (${titulo}) es página de desambiguación, re-buscando...`);
        const nuevoTitulo = await resolverTituloWikipedia(jugador.nombre);
        await esperar(500);

        if (!nuevoTitulo || nuevoTitulo === titulo) {
          desambiguacionSinResolver.push(jugador.nombre);
          return;
        }

        const nuevaUrl = await obtenerImagenWikipedia(nuevoTitulo);
        await prisma.player.update({
          where: { id: jugador.id },
          data: { externalId: `wiki:${nuevoTitulo}`, ...(nuevaUrl ? { imagenUrl: nuevaUrl } : {}) },
        });

        recuperadosPorReDesambiguacion.push({ nombre: jugador.nombre, tituloViejo: titulo, tituloNuevo: nuevoTitulo });
        if (nuevaUrl) actualizados++;
        console.log(`    ✓ Re-resuelto a "${nuevoTitulo}"${nuevaUrl ? " (con imagen)" : " (sin imagen tampoco)"}`);
        return;
      }

      sinImagenReal.push(jugador.nombre);
    }
  );

  console.log(`\n=== Resumen ===`);
  console.log(`Actualizados con imagen: ${actualizados}`);
  console.log(`Re-resueltos por desambiguación: ${recuperadosPorReDesambiguacion.length}`);
  console.log(`Desambiguación sin resolver: ${desambiguacionSinResolver.length}`);
  console.log(`Sin imagen real en Wikipedia: ${sinImagenReal.length}`);
  console.log(`Sin externalId válido: ${sinExternalIdValido.length}`);

  const lineas = [
    "=== Re-resueltos por desambiguación (revisar que sea la persona correcta) ===",
    ...recuperadosPorReDesambiguacion.map((r) => `${r.nombre}: "${r.tituloViejo}" -> "${r.tituloNuevo}"`),
    "",
    "=== Desambiguación sin resolver ===",
    ...desambiguacionSinResolver,
    "",
    "=== Sin imagen real en Wikipedia ===",
    ...sinImagenReal,
    "",
    "=== Sin externalId válido ===",
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