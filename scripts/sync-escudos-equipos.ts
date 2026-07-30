// scripts/sync-escudos-equipos.ts
//
// Rellena Team.escudo (URL del escudo) para los equipos "elegibles"
// definidos en scripts/listaEquiposElegibles.ts — los que salen en el
// generador del 3x3 y por tanto en el fallback de PlayerSearch. Es el
// mismo archivo de datos que usa marcarEquiposElegibles.ts, para no tener
// el listado de equipos duplicado en dos sitios.
//
// Busca el escudo en API-Football por NOMBRE (no requiere que el equipo
// ya tenga externalId guardado), y si lo encuentra:
//   - actualiza Team.escudo
//   - si el equipo no tenía externalId, también lo guarda de paso
//
// Ejecutar con:
//   npx tsx scripts/sync-escudos-equipos.ts
//   npx tsx scripts/sync-escudos-equipos.ts --dry-run       (no escribe nada)
//   npx tsx scripts/sync-escudos-equipos.ts --solo-fallos   (solo reintenta los de sync-escudos-fallos.txt)
//
// Requiere en .env: DATABASE_URL y API_FOOTBALL_KEY.
// Idempotente: si vuelves a ejecutarlo, solo toca los que sigan sin escudo
// (comprueba Team.escudo ANTES de gastar ninguna petición a la API, así que
// re-ejecutar sin --solo-fallos también es seguro y barato para los que ya
// tienen escudo puesto, aunque no estén en la lista de fallos).

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import * as fs from "fs";
import * as path from "path";
import { EQUIPOS_ELEGIBLES } from "./listaEquiposElegibles";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const API_KEY = process.env.API_FOOTBALL_KEY;
const BASE_URL = "https://v3.football.api-sports.io";

const DRY_RUN = process.argv.includes("--dry-run");
const SOLO_FALLOS = process.argv.includes("--solo-fallos");
const PAUSA_MS = 6500; // ~9 peticiones/minuto, por debajo del límite de 10/min de API-Football

const FALLOS_PATH = path.resolve(process.cwd(), "scripts/sync-escudos-fallos.txt");

function esperar(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Lee scripts/sync-escudos-fallos.txt y extrae los nombres (de la lista de
 * elegibles, no los de la BD) que aparecieron en algún fallo, para poder
 * reintentar solo esos con --solo-fallos en vez de repasar los 63 de golpe.
 * Cada línea de fallo tiene el formato `${nombre} / BD:"..." — <motivo>`,
 * así que basta con quedarnos con lo que hay antes de ` / BD:`.
 */
function leerNombresDeFallos(): string[] {
  if (!fs.existsSync(FALLOS_PATH)) return [];
  const contenido = fs.readFileSync(FALLOS_PATH, "utf-8");
  const nombres = new Set<string>();
  for (const linea of contenido.split("\n")) {
    const m = linea.match(/^(.+?) \/ BD:/);
    if (m) nombres.add(m[1].trim());
  }
  return [...nombres];
}

type ApiFootballTeamsResponse = {
  errors?: Record<string, string> | unknown[];
  response: { team: { id: number; name: string; logo: string | null } }[];
};

/** true si detectamos que el error viene de cuota/rate-limit, no de "no existe ese equipo". */
function esErrorDeLimite(mensaje: string): boolean {
  return /limit|rate|quota|too many/i.test(mensaje);
}

class ErrorApiFootball extends Error {
  esLimite: boolean;
  constructor(mensaje: string, esLimite: boolean) {
    super(mensaje);
    this.esLimite = esLimite;
  }
}

async function buscarEnApiFootballCrudo(nombre: string) {
  const res = await fetch(`${BASE_URL}/teams?search=${encodeURIComponent(nombre)}`, {
    headers: { "x-apisports-key": API_KEY! },
  });
  const data = (await res.json()) as ApiFootballTeamsResponse;

  // La API de API-Football normalmente responde 200 incluso cuando el
  // problema es cuota/rate-limit: lo indica dentro de `errors`, no con el
  // status HTTP. Antes esto se colaba como "sin resultado en API-Football"
  // (respuesta vacía), indistinguible de un equipo que de verdad no existe.
  const tieneErrores =
    data.errors && (Array.isArray(data.errors) ? data.errors.length > 0 : Object.keys(data.errors).length > 0);
  if (tieneErrores) {
    const mensaje = JSON.stringify(data.errors);
    throw new ErrorApiFootball(mensaje, esErrorDeLimite(mensaje));
  }
  if (!res.ok) {
    throw new ErrorApiFootball(`HTTP ${res.status}`, res.status === 429);
  }

  return data?.response?.[0]?.team ?? null;
}

// ------------------------------------------------------------
// Emparejamiento de nombres (misma lógica que sync-top-scorers.ts):
// que "Real Madrid" en la lista de elegibles encuentre "Real Madrid CF"
// en la BD, "Betis" encuentre "Real Betis", etc. Comparar con `equals`
// exacto fallaba constantemente porque la BD guarda los nombres oficiales
// completos del scrapeo, no los nombres cortos de la lista de elegibles.
// ------------------------------------------------------------

/** "Ángel Di María" -> "angel di maria" */
function normalizar(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const RUIDO_CLUB = new Set([
  "fc", "cf", "rc", "rcd", "cd", "ud", "sd", "ca", "ac", "as", "sc", "sl",
  "sad", "club", "de", "del", "futbol", "football",
]);
function normalizarEquipo(nombre: string): string {
  return normalizar(nombre)
    .split(" ")
    .filter((p) => p && !RUIDO_CLUB.has(p))
    .join(" ");
}

/**
 * Quita las mismas siglas de ruido (FC, CF, Club, "de"...) pero conservando
 * tildes/mayúsculas del nombre original, para usarlo como término de
 * búsqueda en API-Football. Resulta que API-Football indexa a los grandes
 * clubes por su nombre corto ("Real Madrid", "Getafe", "Manchester City")
 * y buscar con la sigla pegada ("Real Madrid CF", "Getafe CF") no da
 * ningún resultado, al revés de lo que uno esperaría.
 */
function limpiarParaBusquedaApi(nombre: string): string {
  const limpio = nombre
    .split(" ")
    .filter((tok) => tok && !RUIDO_CLUB.has(normalizar(tok)))
    .join(" ")
    .trim();
  return limpio || nombre;
}

/** Busca primero con el nombre "limpio" (sin siglas) y, si falla, con el nombre tal cual. */
async function buscarEnApiFootball(nombreDb: string) {
  const limpio = limpiarParaBusquedaApi(nombreDb);
  const porLimpio = await buscarEnApiFootballCrudo(limpio);
  if (porLimpio) return porLimpio;
  if (limpio === nombreDb) return null;
  // Pequeña pausa extra: este reintento es una segunda petición dentro de
  // la misma vuelta del bucle, para no acercarnos al límite de 10/min.
  await esperar(1000);
  return buscarEnApiFootballCrudo(nombreDb);
}

async function main() {
  if (!API_KEY) {
    console.error("Falta API_FOOTBALL_KEY en tu .env");
    process.exit(1);
  }

  console.log(`Modo: ${DRY_RUN ? "dry-run (no escribe nada)" : "real"}`);

  // Traemos toda la tabla una vez (2300 y pico filas, no pasa nada) para
  // poder emparejar por nombre normalizado + contención en memoria, en vez
  // de una query `equals` por cada elegible que falla en cuanto la BD
  // guarda "Real Madrid CF" y la lista dice "Real Madrid".
  const equipos = await prisma.team.findMany({
    select: { id: true, nombre: true, escudo: true, externalId: true },
  });
  const eqPorNombre = new Map(equipos.map((e) => [normalizarEquipo(e.nombre), e]));
  // Para detectar de antemano si el externalId que vamos a guardar ya lo
  // tiene otra fila (típico de los duplicados/basura del scrapeo que hay
  // pendientes de limpiar en Team) -- Team.externalId es @unique, así que
  // si no lo comprobamos antes, Prisma revienta al hacer el update.
  const eqPorExternalId = new Map(equipos.filter((e) => e.externalId).map((e) => [e.externalId!, e]));

  function buscarEquipoDb(nombre: string) {
    const clave = normalizarEquipo(nombre);
    if (eqPorNombre.has(clave)) return eqPorNombre.get(clave)!;

    // Fallback: uno contiene al otro ("Betis" <-> "Real Betis"). Solo si
    // hay UNA coincidencia, para no adivinar mal entre varios candidatos.
    const parciales = [...eqPorNombre.entries()].filter(
      ([k]) => k.includes(clave) || clave.includes(k)
    );
    return parciales.length === 1 ? parciales[0][1] : null;
  }

  /** Equipos de la BD que comparten alguna palabra larga, para sugerir cuando no hay match */
  function sugerirEquipos(nombre: string): string[] {
    const palabras = normalizarEquipo(nombre)
      .split(" ")
      .filter((p) => p.length >= 4);
    if (palabras.length === 0) return [];
    return equipos
      .filter((e) => {
        const suyas = normalizarEquipo(e.nombre).split(" ");
        return palabras.some((p) => suyas.includes(p));
      })
      .map((e) => e.nombre)
      .slice(0, 5);
  }

  // La lista tiene algún nombre repetido (p.ej. "Schalke 04" dos veces); nos
  // quedamos con nombres únicos para no gastar peticiones de más.
  let nombresUnicos = [...new Set(EQUIPOS_ELEGIBLES)];

  if (SOLO_FALLOS) {
    const nombresFallos = leerNombresDeFallos();
    if (nombresFallos.length === 0) {
      console.log(
        `--solo-fallos activado pero ${FALLOS_PATH} no existe o no tiene fallos registrados. Nada que hacer.`
      );
      await prisma.$disconnect();
      return;
    }
    // Solo los que sigan estando en la lista de elegibles actual (por si el
    // archivo de fallos tiene nombres de una versión antigua de la lista).
    const setElegibles = new Set(nombresUnicos);
    nombresUnicos = nombresFallos.filter((n) => setElegibles.has(n));
    console.log(`Modo --solo-fallos: reintentando ${nombresUnicos.length} equipo(s) de ${FALLOS_PATH}`);
  }

  console.log(`Equipos elegibles a comprobar: ${nombresUnicos.length}\n`);

  let actualizados = 0;
  let yaTenianEscudo = 0;
  const noEncontrados: string[] = [];
  const fallos: string[] = [];

  for (const [i, nombre] of nombresUnicos.entries()) {
    process.stdout.write(`[${i + 1}/${nombresUnicos.length}] ${nombre} ... `);

    const equipoDb = buscarEquipoDb(nombre);

    if (!equipoDb) {
      const sugerencias = sugerirEquipos(nombre);
      console.log(
        sugerencias.length > 0
          ? `✗ no encontrado. ¿Quizás? ${sugerencias.join(" / ")}`
          : "✗ no encontrado en la BD"
      );
      noEncontrados.push(nombre);
      continue; // no gasta petición de API si no existe en la BD
    }

    if (equipoDb.escudo) {
      console.log(`· ya tenía escudo (${equipoDb.nombre})`);
      yaTenianEscudo++;
      continue;
    }

    try {
      // Buscamos en API-Football por el nombre TAL COMO ESTÁ EN LA BD
      // (más oficial/completo que el de la lista de elegibles), da mejores
      // resultados de búsqueda.
      let equipoApi;
      try {
        equipoApi = await buscarEnApiFootball(equipoDb.nombre);
      } catch (e) {
        const error = e as Error;
        console.log(`✗ error de API-Football: ${error.message}`);
        fallos.push(`${nombre} / BD:"${equipoDb.nombre}" — API-Football: ${error.message}`);

        // Si es un error de cuota/rate-limit, seguir intentando con el resto
        // solo quemaría más peticiones (probablemente fallen todos igual) y
        // ensuciaría el log. Cortamos aquí y que se reintente más tarde --
        // como el script es idempotente, no repite trabajo ya hecho.
        if (error instanceof ErrorApiFootball && error.esLimite) {
          console.log(
            `\n⚠ Parece un límite de cuota/rate-limit de API-Football, no que estos equipos no existan.` +
              ` Paro aquí para no gastar más peticiones -- vuelve a ejecutar el script más tarde` +
              ` (o mañana, si es el límite diario) y seguirá justo por donde se quedó.`
          );
          break;
        }
        if (i < nombresUnicos.length - 1) await esperar(PAUSA_MS);
        continue;
      }

      if (!equipoApi?.logo) {
        console.log(`✗ sin resultado en API-Football (buscado como "${equipoDb.nombre}")`);
        fallos.push(`${nombre} / BD:"${equipoDb.nombre}" — sin resultado/logo en API-Football`);
      } else {
        // Si el equipo no tenía externalId todavía, solo se lo asignamos si
        // ninguna otra fila lo tiene ya (Team.externalId es @unique). Si hay
        // conflicto, es casi seguro una fila duplicada/basura del scrapeo
        // (ver ROADMAP) -- se avisa pero no se bloquea el escudo por eso.
        let externalIdNuevo: string | undefined;
        let avisoDuplicado = "";
        if (!equipoDb.externalId) {
          const candidato = String(equipoApi.id);
          const conflicto = eqPorExternalId.get(candidato);
          if (conflicto && conflicto.id !== equipoDb.id) {
            avisoDuplicado = ` [aviso: externalId ${candidato} ya lo tiene "${conflicto.nombre}" -- probable duplicado en Team, no se ha tocado externalId aquí]`;
          } else {
            externalIdNuevo = candidato;
          }
        }

        try {
          if (!DRY_RUN) {
            await prisma.team.update({
              where: { id: equipoDb.id },
              data: {
                escudo: equipoApi.logo,
                ...(externalIdNuevo ? { externalId: externalIdNuevo } : {}),
              },
            });
          }
          console.log(`✓ (${equipoDb.nombre}) ${equipoApi.logo}${avisoDuplicado}`);
          actualizados++;
        } catch (e) {
          const error = e as Error;
          console.log(`✗ error al guardar en la BD: ${error.message}`);
          fallos.push(`${nombre} / BD:"${equipoDb.nombre}" — guardar en BD: ${error.message}`);
        }
      }
    } catch (e) {
      // Red de seguridad por si algo más (no la API, no el guardado) falla.
      const error = e as Error;
      console.log(`✗ error inesperado: ${error.message}`);
      fallos.push(`${nombre} / BD:"${equipoDb.nombre}" — ${error.message}`);
    }

    // Solo esperamos si de verdad hicimos una petición a la API en esta vuelta.
    if (i < nombresUnicos.length - 1) await esperar(PAUSA_MS);
  }

  console.log(`\n=== Resumen ===`);
  console.log(`Escudos actualizados: ${actualizados}`);
  console.log(`Ya tenían escudo: ${yaTenianEscudo}`);
  console.log(`No encontrados en la BD: ${noEncontrados.length}`);
  console.log(`Fallos al buscar en API-Football: ${fallos.length}`);

  if (noEncontrados.length > 0) {
    console.log(`\nEquipos elegibles que no se pudieron emparejar con la BD:`);
    noEncontrados.forEach((n) => console.log(`  - ${n}`));
  }

  if (fallos.length > 0) {
    fs.appendFileSync(
      FALLOS_PATH,
      `\n--- Ejecución ${new Date().toISOString()} ---\n${fallos.join("\n")}\n`
    );
    console.log(`\nDetalle de fallos añadido a ${FALLOS_PATH}`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});