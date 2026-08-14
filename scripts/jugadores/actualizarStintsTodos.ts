// scripts/jugadores/actualizarStintsTodos.ts
//
// Mantenimiento periódico: recorre TODOS los jugadores ya existentes en la
// BD y vuelve a sincronizar su ficha completa (incluidos los Stints) desde
// su página de Wikipedia -- mismo motor que resincronizarJugador.ts
// (syncJugadorDesdeWikipedia), pero para toda la plantilla en vez de uno
// solo. Pensado para lanzarse de vez en cuando (ej. tras el cierre de un
// mercado de fichajes) y detectar jugadores que han cambiado de club, se
// han retirado, o cuyos datos han cambiado en Wikipedia desde la última
// sincronización.
//
// CON ~5000 JUGADORES ESTO NO SE TERMINA EN UNA SENTADA: con la pausa de
// cortesía (1.2s) más la red real, la tanda completa son varias horas
// (orden de 4-6h). Por eso el script guarda su progreso automáticamente
// en data/jugadores/actualizar-stints-progreso.json y, si lo cortas
// (Ctrl+C, se cierra la terminal, se cae la red...) y lo vuelves a
// lanzar SIN opciones, retoma solo justo donde se quedó -- no hace falta
// buscar a mano el último id. Los ficheros de cambios/fallos también se
// van AÑADIENDO (no se pisan) entre tandas, para no perder el historial
// de una ejecución larga partida en varios días.
//
// Uso: npx tsx scripts/jugadores/actualizarStintsTodos.ts [opciones]
//
//   (sin opciones)  Retoma automáticamente donde se quedó la última tanda
//                   (o empieza desde el principio si es la primera vez).
//   --limit=N       Procesa como máximo N jugadores en esta tanda y para
//                   ahí (guardando progreso igualmente). Útil para trocear
//                   la tanda completa en sesiones más cortas, ej. 500 en
//                   500, o para probar con pocos antes de lanzar en serio.
//   --reiniciar     Ignora el progreso guardado y empieza desde el primer
//                   jugador (alfabético), como si fuera la primera vez.
//                   También reinicia los ficheros de cambios/fallos.
//   --desde=<id>    Empieza a partir de este id de Player concreto,
//                   ignorando el progreso guardado. Para casos puntuales
//                   en los que quieres forzar un punto de partida exacto.
//
// Para cada jugador:
//   - Si su externalId tiene forma "wiki:<Título>" (caso normal, lo pone
//     syncJugadorDesdeWikipedia al crearlo), se reconstruye la URL exacta
//     de esa página y se pasa como urlManual -- va directo a la página
//     correcta sin pasar por la búsqueda por nombre, más rápido y sin
//     riesgo de acabar en la página de un homónimo.
//   - Si no tiene externalId con ese formato (jugador metido a mano, caso
//     raro), cae a la búsqueda automática por nombre de siempre.
//
// syncJugadorDesdeWikipedia hace upsert sobre el id exacto del jugador (se
// le pasa playerIdExistente) y borra+recrea sus Stint desde cero a partir
// del wikitext actual -- así que un fichaje nuevo, un final de etapa o una
// corrección en Wikipedia quedan reflejados sin duplicar nada. Se compara
// el nº de etapas antes/después de cada jugador para destacar en el
// resumen quién ha cambiado de verdad, así no hace falta leer miles de
// líneas de log si solo cambiaron unos pocos.

import "dotenv/config";
import { readFile, writeFile, appendFile } from "node:fs/promises";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { syncJugadorDesdeWikipedia } from "../../src/lib/scraping/wikipediaSync";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Misma pausa entre jugadores que scripts/jugadores/syncPlayers.ts --
// cortesía con la API de Wikipedia. Con miles de jugadores en la BD, no
// conviene bajarla: aunque cada jugador solo hace ~3 peticiones (wikitext,
// wikidata, imagen) al ir directo por URL, en una tanda de 5000 son del
// orden de 15000 peticiones seguidas desde la misma IP, y esta pausa es lo
// que evita que Wikipedia empiece a devolver 429 a mitad de tanda.
const PAUSA_MS = 1200;

const RUTA_PROGRESO = "data/jugadores/actualizar-stints-progreso.json";
const RUTA_CAMBIOS = "data/jugadores/actualizar-stints-cambios.txt";
const RUTA_FALLOS = "data/jugadores/actualizar-stints-fallos.txt";

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

function leerOpciones() {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let desde: string | undefined;
  let reiniciar = false;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) limit = parseInt(arg.slice("--limit=".length), 10);
    if (arg.startsWith("--desde=")) desde = arg.slice("--desde=".length);
    if (arg === "--reiniciar") reiniciar = true;
  }

  return { limit, desde, reiniciar };
}

type Progreso = { ultimoIdProcesado: string; ultimoNombreProcesado: string; actualizadoEn: string };

async function leerProgreso(): Promise<Progreso | null> {
  try {
    const raw = await readFile(RUTA_PROGRESO, "utf-8");
    return JSON.parse(raw) as Progreso;
  } catch {
    return null; // no existe todavía (primera vez) o está corrupto -- tratamos igual, se sobreescribe
  }
}

async function guardarProgreso(p: Progreso) {
  await writeFile(RUTA_PROGRESO, JSON.stringify(p, null, 2), "utf-8");
}

// "wiki:Kevin De Bruyne" -> "https://en.wikipedia.org/wiki/Kevin_De_Bruyne"
// Reconstruye la URL a partir del externalId guardado, en vez de fiarse
// del nombre actual del jugador en la BD (que puede haberse editado a
// mano y ya no coincidir con el título real de Wikipedia).
function urlDesdeExternalId(externalId: string | null): string | undefined {
  if (!externalId?.startsWith("wiki:")) return undefined;
  const titulo = externalId.slice("wiki:".length);
  return `https://en.wikipedia.org/wiki/${encodeURI(titulo.replace(/ /g, "_"))}`;
}

async function main() {
  const { limit, desde, reiniciar } = leerOpciones();

  const todos = await prisma.player.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { stints: true } } },
  });

  let jugadores = todos;
  let motivoInicio = "desde el principio (primera vez o --reiniciar)";

  if (desde) {
    const idx = jugadores.findIndex((j) => j.id === desde);
    if (idx === -1) {
      console.error(`No se encontró ningún jugador con id "${desde}" (--desde). Revisa el id.`);
      await prisma.$disconnect();
      process.exit(1);
    }
    jugadores = jugadores.slice(idx);
    motivoInicio = `desde el jugador indicado con --desde (${jugadores[0].nombre})`;
  } else if (!reiniciar) {
    const progreso = await leerProgreso();
    if (progreso) {
      const idx = todos.findIndex((j) => j.id === progreso.ultimoIdProcesado);
      if (idx !== -1 && idx + 1 < todos.length) {
        jugadores = todos.slice(idx + 1);
        motivoInicio = `retomando tras "${progreso.ultimoNombreProcesado}" (progreso guardado el ${progreso.actualizadoEn})`;
      } else if (idx !== -1) {
        console.log(
          `\nEl progreso guardado indica que ya se procesó a todos los jugadores (último: "${progreso.ultimoNombreProcesado}").`
        );
        console.log(`Usa --reiniciar si quieres volver a pasar por todos desde el principio.\n`);
        await prisma.$disconnect();
        return;
      }
      // Si el id guardado ya no existe (se borró ese jugador), seguimos desde el principio.
    }
  }

  // Reiniciar de verdad = vaciar también el historial de cambios/fallos
  // acumulado en tandas anteriores, para no mezclar rondas distintas.
  if (reiniciar) {
    await writeFile(RUTA_CAMBIOS, "", "utf-8").catch(() => {});
    await writeFile(RUTA_FALLOS, "", "utf-8").catch(() => {});
  }

  if (limit) jugadores = jugadores.slice(0, limit);

  console.log(`\n${todos.length} jugadores en total. Arrancando ${motivoInicio}.`);
  console.log(
    `Esta tanda procesará ${jugadores.length} jugador${jugadores.length === 1 ? "" : "es"}` +
      (limit ? ` (--limit=${limit}).` : " (sin límite -- puede tardar varias horas con miles de jugadores).")
  );
  console.log(`Si se corta, vuelve a lanzar el script sin opciones para retomar automáticamente.\n`);

  const cabecera = `\n--- Tanda iniciada ${new Date().toISOString()} ---\n`;
  await appendFile(RUTA_CAMBIOS, cabecera, "utf-8");
  await appendFile(RUTA_FALLOS, cabecera, "utf-8");

  let procesados = 0;
  let sinCambios = 0;
  let conCambios = 0;
  let fallos = 0;

  for (let i = 0; i < jugadores.length; i++) {
    const jugador = jugadores[i];
    const etapasAntes = jugador._count.stints;
    const urlManual = urlDesdeExternalId(jugador.externalId);

    console.log(`[${i + 1}/${jugadores.length}] ${jugador.nombre} (id=${jugador.id})...`);

    const resultado = await syncJugadorDesdeWikipedia(prisma, jugador.nombre, urlManual, jugador.id);

    if (resultado.ok) {
      if (resultado.etapas !== etapasAntes) {
        conCambios++;
        console.log(`  ✓ ${etapasAntes} -> ${resultado.etapas} etapas (¡cambio detectado!)`);
        await appendFile(
          RUTA_CAMBIOS,
          `${jugador.nombre} (${jugador.id}) — ${etapasAntes} -> ${resultado.etapas} etapas\n`,
          "utf-8"
        );
      } else {
        sinCambios++;
        console.log(`  ✓ ${resultado.etapas} etapas (sin cambios)`);
      }
    } else {
      fallos++;
      console.warn(`  ✗ Fallo: ${resultado.motivo}`);
      await appendFile(RUTA_FALLOS, `${jugador.nombre} (${jugador.id}) — ${resultado.motivo}\n`, "utf-8");
    }

    procesados++;
    // Progreso guardado tras CADA jugador (no solo al final) -- si el
    // proceso muere a mitad de tanda, la próxima ejecución retoma desde
    // aquí en vez de repetir cientos de jugadores ya hechos.
    await guardarProgreso({
      ultimoIdProcesado: jugador.id,
      ultimoNombreProcesado: jugador.nombre,
      actualizadoEn: new Date().toISOString(),
    });

    if (i < jugadores.length - 1) await esperar(PAUSA_MS);
  }

  await prisma.$disconnect();

  console.log(`\n=== Resumen de esta tanda ===`);
  console.log(`Procesados: ${procesados}`);
  console.log(`Sin cambios: ${sinCambios}`);
  console.log(`Con cambios en nº de etapas: ${conCambios}`);
  console.log(`Fallos: ${fallos}`);
  console.log(`\nDetalle acumulado en ${RUTA_CAMBIOS} y ${RUTA_FALLOS}.`);

  const quedan = todos.length - (todos.findIndex((j) => j.id === jugadores[jugadores.length - 1]?.id) + 1);
  if (limit && quedan > 0) {
    console.log(`\nQuedan ~${quedan} jugadores por procesar. Vuelve a lanzar el script sin opciones para seguir.`);
  } else if (!limit) {
    console.log(`\nTanda completa terminada (todos los jugadores procesados).`);
  }

  if (fallos > 0) {
    console.log(
      `\nPara reintentar solo un jugador fallido: npx tsx scripts/jugadores/resincronizarJugador.ts "<nombre>"`
    );
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});