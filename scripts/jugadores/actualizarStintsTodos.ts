// scripts/jugadores/actualizarStintsTodos.ts
//
// Mantenimiento periódico: recorre TODOS los jugadores existentes en la BD
// y vuelve a sincronizar sus Stints desde su página de Wikipedia -- mismo
// motor que resincronizarJugador.ts (syncJugadorDesdeWikipedia), pero para
// toda la plantilla en vez de uno solo. Pensado para lanzarse de vez en
// cuando (ej. tras el cierre de un mercado de fichajes) y detectar
// jugadores que han cambiado de club, se han retirado, o cuyos datos han
// cambiado en Wikipedia desde la última sincronización.
//
// SIN paralelizar, SIN saltarse a nadie: procesa a todos los jugadores en
// un único proceso secuencial, sin excepciones. Se descartaron ambas cosas
// a propósito:
//   - Paralelizar (varios procesos a la vez) arriesgaba crear equipos
//     duplicados en `Team` (sin restricción única en `nombre`, deduplica
//     solo con caché en memoria por proceso) y forzar el ritmo real de
//     peticiones a Wikipedia por encima de lo prudente.
//   - "Saltarse a los retirados" se basaba en que equipoActualId fuera
//     null para detectar quién no juega ya en ningún sitio -- pero
//     equipoActualId puede quedarse apuntando al ÚLTIMO club en el que
//     jugó (el campo `currentclub` del infobox de Wikipedia no siempre se
//     limpia al retirarse), así que esa señal no es fiable y se descartó.
//
// LA OPTIMIZACIÓN DE VERDAD: por defecto, syncJugadorDesdeWikipedia hace 3
// peticiones de red por jugador (wikitext, nacionalidad vía Wikidata,
// foto). Como aquí solo nos interesan los Stints (que salen enteros del
// wikitext, ya incluido en la primera petición), este script llama a
// syncJugadorDesdeWikipedia con `{ omitirNacionalidadEImagen: true }`
// (ver src/lib/scraping/wikipediaSync.ts), así que cada jugador hace UNA
// sola petición de red en vez de tres. La nacionalidad no se pierde del
// todo -- se queda con lo que ya sale del wikitext parseado (sin coste de
// red extra), solo se pierde el refinamiento adicional de Wikidata; la
// foto (`imagenUrl`) directamente no se toca si el jugador ya existía (no
// se pisa con null). Con 1 petición por jugador en vez de 3, la pausa de
// cortesía entre jugadores también se pudo bajar con más margen -- ver
// PAUSA_MS más abajo.
//
// CON ~5000 JUGADORES ESTO SIGUE SIN TERMINAR EN UNA SENTADA (aunque ahora
// bastante más rápido que la primera versión -- ver estimación en
// PAUSA_MS). Por eso el script guarda su progreso automáticamente en
// data/jugadores/actualizar-stints-progreso.json y, si lo cortas (Ctrl+C,
// se cierra la terminal, se cae la red...) y lo vuelves a lanzar SIN
// opciones, retoma solo justo donde se quedó -- no hace falta buscar a
// mano el último id. Los ficheros de cambios/fallos también se van
// AÑADIENDO (no se pisan) entre tandas, para no perder el historial de una
// ejecución larga partida en varios días.
//
// Uso: npx tsx scripts/jugadores/actualizarStintsTodos.ts [opciones]
//
//   (sin opciones)  Retoma automáticamente donde se quedó la última tanda
//                   (o empieza desde el principio si es la primera vez).
//   --limit=N       Procesa como máximo N jugadores en esta tanda y para
//                   ahí (guardando progreso igualmente). Útil para trocear
//                   la tanda completa en sesiones más cortas, o para
//                   probar con pocos antes de lanzar en serio.
//   --reiniciar     Ignora el progreso guardado y empieza desde el primer
//                   jugador (alfabético), como si fuera la primera vez.
//                   También reinicia los ficheros de cambios/fallos.
//   --desde=<id>    Empieza a partir de este id de Player concreto,
//                   ignorando el progreso guardado. Para casos puntuales
//                   en los que quieres forzar un punto de partida exacto.
//   --reintentar-fallos  Ignora el progreso normal y procesa SOLO a los
//                   jugadores que aparecen en
//                   data/jugadores/actualizar-stints-fallos.txt (extrae
//                   sus ids de las líneas ya guardadas ahí). Pensado para
//                   después de corregir algo a mano (ej. un externalId mal
//                   editado) y querer comprobar solo esos, sin relanzar la
//                   tanda completa. Al terminar, REESCRIBE ese fichero
//                   (no lo añade) dejando solo a quienes sigan fallando --
//                   los que se arreglen desaparecen de la lista. No toca
//                   el progreso de la tanda grande (actualizar-stints-
//                   progreso.json), así que una tanda normal posterior
//                   sigue donde estaba como si esto no hubiera pasado.
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

// Con la optimización de 1 sola petición por jugador (en vez de 3), el
// cuello de botella hacia en.wikipedia.org baja mucho -- se puede permitir
// una pausa más corta que la de scripts/jugadores/syncPlayers.ts (1.2s,
// pensada para 3 peticiones repartidas entre dos dominios). 700ms sigue
// siendo prudente: a ese ritmo son ~1.3 peticiones/segundo sostenidas
// contra la misma API, bien por debajo de lo que suele hacer saltar un
// rate-limit real. Con 5000 jugadores y ~700ms de pausa + la petición en
// sí (variable, pero digamos ~300-600ms de media), la tanda completa baja
// de las 4-6h de la primera versión a algo del orden de 1.5-2h.
const PAUSA_MS = 700;

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

type Opciones = { limit?: number; desde?: string; reiniciar: boolean; reintentarFallos: boolean };

function leerOpciones(): Opciones {
  const args = process.argv.slice(2);
  let limit: number | undefined;
  let desde: string | undefined;
  let reiniciar = false;
  let reintentarFallos = false;

  for (const arg of args) {
    if (arg.startsWith("--limit=")) limit = parseInt(arg.slice("--limit=".length), 10);
    if (arg.startsWith("--desde=")) desde = arg.slice("--desde=".length);
    if (arg === "--reiniciar") reiniciar = true;
    if (arg === "--reintentar-fallos") reintentarFallos = true;
  }

  return { limit, desde, reiniciar, reintentarFallos };
}

// Extrae los ids de Player de las líneas ya guardadas en
// actualizar-stints-fallos.txt, con forma "Nombre (id) — motivo".
// Ignora las líneas de cabecera ("--- Tanda iniciada ... ---") y en
// blanco sin más -- no hace falta distinguirlas explícitamente, simplemente
// no matchean el patrón.
async function leerIdsFallidos(): Promise<Set<string>> {
  try {
    const raw = await readFile(RUTA_FALLOS, "utf-8");
    const ids = new Set<string>();
    for (const linea of raw.split("\n")) {
      const m = linea.match(/\(([^()]+)\)\s+—\s+\S/);
      if (m) ids.add(m[1]);
    }
    return ids;
  } catch {
    return new Set();
  }
}

const RUTA_PROGRESO = "data/jugadores/actualizar-stints-progreso.json";
const RUTA_CAMBIOS = "data/jugadores/actualizar-stints-cambios.txt";
const RUTA_FALLOS = "data/jugadores/actualizar-stints-fallos.txt";

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
  const { limit, desde, reiniciar, reintentarFallos } = leerOpciones();

  const todos = await prisma.player.findMany({
    orderBy: { nombre: "asc" },
    include: { _count: { select: { stints: true } } },
  });

  let jugadores = todos;
  let motivoInicio = "desde el principio (primera vez o --reiniciar)";

  if (reintentarFallos) {
    const idsFallidos = await leerIdsFallidos();
    if (idsFallidos.size === 0) {
      console.log(`\nNo hay fallos registrados en ${RUTA_FALLOS} (o el fichero no existe). Nada que reintentar.\n`);
      await prisma.$disconnect();
      return;
    }
    jugadores = todos.filter((j) => idsFallidos.has(j.id));
    motivoInicio = `reintentando solo los ${jugadores.length} fallos previos de ${RUTA_FALLOS} (${idsFallidos.size} ids registrados, ${idsFallidos.size - jugadores.length} ya no existen en la BD)`;
  } else if (desde) {
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
  // No aplica en modo --reintentar-fallos (ese modo gestiona RUTA_FALLOS
  // por su cuenta, reescribiéndolo al final con quien siga fallando).
  if (reiniciar && !reintentarFallos) {
    await writeFile(RUTA_CAMBIOS, "", "utf-8").catch(() => {});
    await writeFile(RUTA_FALLOS, "", "utf-8").catch(() => {});
  }

  if (limit) jugadores = jugadores.slice(0, limit);

  console.log(`\n${todos.length} jugadores en total. Arrancando ${motivoInicio}.`);
  console.log(
    `Esta tanda procesará ${jugadores.length} jugador${jugadores.length === 1 ? "" : "es"}` +
      (limit ? ` (--limit=${limit}).` : " (sin límite -- puede tardar 1-2h con miles de jugadores).")
  );
  if (!reintentarFallos) {
    console.log(`Si se corta, vuelve a lanzar el script sin opciones para retomar automáticamente.\n`);
  } else {
    console.log(`Modo --reintentar-fallos: no afecta al progreso de la tanda grande.\n`);
  }

  const cabecera = `\n--- Tanda iniciada ${new Date().toISOString()} ---\n`;
  await appendFile(RUTA_CAMBIOS, cabecera, "utf-8");
  // En modo normal, los fallos se van añadiendo según ocurren (ver más
  // abajo). En modo --reintentar-fallos NO se toca el fichero aquí --  se
  // reescribe entero al final, con quien siga fallando tras el reintento.
  if (!reintentarFallos) {
    await appendFile(RUTA_FALLOS, cabecera, "utf-8");
  }

  let procesados = 0;
  let sinCambios = 0;
  let conCambios = 0;
  let fallos = 0;
  const siguenFallando: { nombre: string; id: string; motivo: string }[] = [];

  for (let i = 0; i < jugadores.length; i++) {
    const jugador = jugadores[i];
    const etapasAntes = jugador._count.stints;
    const urlManual = urlDesdeExternalId(jugador.externalId);

    console.log(`[${i + 1}/${jugadores.length}] ${jugador.nombre} (id=${jugador.id})...`);

    const resultado = await syncJugadorDesdeWikipedia(prisma, jugador.nombre, urlManual, jugador.id, {
      omitirNacionalidadEImagen: true,
    });

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
      if (reintentarFallos) console.log(`  → arreglado, sale de la lista de fallos`);
    } else {
      fallos++;
      console.warn(`  ⚠ SALTADO (${resultado.motivo}) -- no se pudo sincronizar, se pasa al siguiente jugador`);
      if (reintentarFallos) {
        siguenFallando.push({ nombre: jugador.nombre, id: jugador.id, motivo: resultado.motivo });
      } else {
        await appendFile(RUTA_FALLOS, `${jugador.nombre} (${jugador.id}) — ${resultado.motivo}\n`, "utf-8");
      }
    }

    procesados++;
    if (!reintentarFallos) {
      await guardarProgreso({
        ultimoIdProcesado: jugador.id,
        ultimoNombreProcesado: jugador.nombre,
        actualizadoEn: new Date().toISOString(),
      });
    }

    if (i < jugadores.length - 1) await esperar(PAUSA_MS);
  }

  await prisma.$disconnect();

  if (reintentarFallos) {
    const contenido =
      siguenFallando.length > 0
        ? `\n--- Reintento ${new Date().toISOString()} -- siguen fallando tras corregir ---\n` +
          siguenFallando.map((f) => `${f.nombre} (${f.id}) — ${f.motivo}`).join("\n") +
          "\n"
        : "";
    await writeFile(RUTA_FALLOS, contenido, "utf-8");
  }

  console.log(`\n=== Resumen de esta tanda${reintentarFallos ? " (--reintentar-fallos)" : ""} ===`);
  console.log(`Procesados: ${procesados}`);
  console.log(`Sin cambios: ${sinCambios}`);
  console.log(`Con cambios en nº de etapas: ${conCambios}`);
  console.log(`Fallos: ${fallos}`);
  console.log(`\nDetalle de cambios acumulado en ${RUTA_CAMBIOS}.`);

  if (reintentarFallos) {
    console.log(
      siguenFallando.length > 0
        ? `${siguenFallando.length} siguen fallando -- reescrito ${RUTA_FALLOS} con solo esos.`
        : `Todos arreglados -- ${RUTA_FALLOS} vaciado.`
    );
    return;
  }

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