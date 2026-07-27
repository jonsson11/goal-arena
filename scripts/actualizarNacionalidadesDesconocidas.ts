// scripts/actualizarNacionalidadesDesconocidas.ts
//
// Re-sincroniza contra Wikipedia + Wikidata a todos los jugadores que
// ahora mismo tienen nacionalidad = "Desconocida". Primero intenta la
// URL exacta guardada en externalId; si esa URL ahora apunta a una
// página de desambiguación (el título se movió porque apareció otro
// "Fulano" notable en Wikipedia), reintenta con la búsqueda automática
// de 4 estrategias, actualizando la MISMA fila por id -- para no acabar
// con jugadores duplicados.
// Ejecutar con: npx tsx scripts/actualizarNacionalidadesDesconocidas.ts

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../src/lib/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

function urlDesdeExternalId(externalId: string): string | null {
  if (!externalId.startsWith("wiki:")) return null;
  const titulo = externalId.slice("wiki:".length);
  return `https://en.wikipedia.org/wiki/${encodeURIComponent(titulo.replace(/ /g, "_"))}`;
}

// Motivos que sugieren que el título guardado ya no es la biografía
// (se movió a una página de desambiguación, o directamente desapareció)
// -- vale la pena reintentar con búsqueda en estos casos concretos.
const MOTIVOS_RECUPERABLES = new Set(["sin_infobox", "sin_pagina"]);

async function main() {
  const jugadores = await prisma.player.findMany({
    where: { nacionalidad: "Desconocida" },
    select: { id: true, nombre: true, externalId: true },
  });

  console.log(`Jugadores con nacionalidad Desconocida: ${jugadores.length}\n`);

  let resueltos = 0;
  const recuperadosPorBusqueda: { nombre: string; tituloNuevo: string }[] = [];
  let siguenDesconocidos = 0;
  const fallos: { nombre: string; motivo: string }[] = [];
  for (const jugador of jugadores) {
    if (!jugador.externalId) {
      console.warn(`  ✗ ${jugador.nombre}: sin externalId, no se puede re-sincronizar. Se salta.`);
      fallos.push({ nombre: jugador.nombre, motivo: "sin_external_id" });
      continue;
    }

    const url = urlDesdeExternalId(jugador.externalId);
    console.log(`→ ${jugador.nombre}...`);

    let resultado = url
      ? await syncJugadorDesdeWikipedia(prisma, jugador.nombre, url)
      : { ok: false as const, motivo: "external_id_invalido" };

    // La URL guardada ya no lleva a la biografía (título movido a
    // desambiguación, o borrado). Reintenta con búsqueda automática,
    // actualizando la MISMA fila (playerIdExistente) para no duplicar.
    if (!resultado.ok && MOTIVOS_RECUPERABLES.has(resultado.motivo)) {
      console.log(`  … URL guardada ya no es válida (${resultado.motivo}), reintentando con búsqueda automática...`);
      resultado = await syncJugadorDesdeWikipedia(prisma, jugador.nombre, undefined, jugador.id);

      if (resultado.ok && resultado.renombrado) {
        recuperadosPorBusqueda.push({ nombre: jugador.nombre, tituloNuevo: resultado.nombreUsado });
      }
    }

    if (!resultado.ok) {
      console.warn(`  ✗ Fallo definitivo: ${resultado.motivo}`);
      fallos.push({ nombre: jugador.nombre, motivo: resultado.motivo });
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
  console.log(`Fallos definitivos: ${fallos.length}`);

  if (recuperadosPorBusqueda.length > 0) {
    console.log(`\n=== Recuperados vía búsqueda automática (revisar que sea la persona correcta) ===`);
    for (const r of recuperadosPorBusqueda) {
      console.log(`  ${r.nombre} -> "${r.tituloNuevo}"`);
    }
  }

  if (fallos.length > 0) {
    console.log(`\n=== Fallos definitivos (candidatos a resolver a mano con URL manual) ===`);
    for (const f of fallos) {
      console.log(`  ${f.nombre} — ${f.motivo}`);
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});