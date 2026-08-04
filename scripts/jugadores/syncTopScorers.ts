/**
 * scripts/jugadores/sync-top-scorers.ts
 *
 * Crea (o actualiza) un Top10Ranking de máximos goleadores de una
 * competición y temporada, listo para jugarse en el minijuego Top 10.
 *
 * ── FUENTES ─────────────────────────────────────────────────────────
 *   API     football-data.org. Solo temporadas que cubra el plan gratuito;
 *           las antiguas devuelven 403.
 *   ARCHIVO Un JSON escrito a mano en data/top10/. Para temporadas que la
 *           API no da, o rankings que no existen como endpoint.
 *
 *   npx tsx scripts/jugadores/sync-top-scorers.ts --competicion=PD --temporada=2024
 *   npx tsx scripts/jugadores/sync-top-scorers.ts --archivo=data/top10/PD-2018.json
 *
 *   --dry-run  enseña lo que haría sin escribir nada. Úsalo siempre antes.
 *
 * ── MÉTRICA ─────────────────────────────────────────────────────────
 *   Solo con --archivo: añade "metrica": "EDAD" al JSON (por defecto es
 *   "GOLES", compatible con todos los archivos ya existentes) y pon el
 *   "valor" de cada entrada como { "anios": 40, "meses": 4, "dias": 17 }
 *   en vez de un número -- útil para rankings tipo "goleadores más
 *   veteranos", donde el dato no es un número simple. Ver plantilla en
 *   data/top10/plantilla-edad.json. Con EDAD no se toca PlayerStat (esa
 *   tabla es solo goles/asistencias por temporada, no aplica aquí).
 *
 * ── QUÉ ESCRIBE ─────────────────────────────────────────────────────
 *   Competition   upsert por `codigo` ("PD"). API y archivo convergen aquí.
 *   PlayerStat    una fila por jugador con sus goles en esa temporada.
 *                 NO toca Player.goles, que es el total de carrera.
 *   Top10Ranking  el reto en sí, + sus 10 Top10Entry (posición, jugador,
 *                 goles, nombre del equipo).
 *
 *   Es idempotente: reejecutarlo actualiza, no duplica.
 *
 * ── EMPAREJAMIENTO ──────────────────────────────────────────────────
 *   Jugadores: 1º por externalId, 2º por nombre o alias normalizados
 *              (sin tildes ni puntuación). Si falta alguno, ABORTA y lo
 *              lista. Nunca crea jugadores: los das de alta tú.
 *   Equipos:   por nombre normalizado ignorando siglas (FC, CD, RCD, de...)
 *              y, si no, por contención ("Celta" ↔ "RC Celta de Vigo").
 *              Si no lo encuentra, avisa pero sigue: el nombre se guarda
 *              igual en Top10Entry.equipoTexto y la UI no se rompe.
 *
 * ── SILENCIO = TODO BIEN ────────────────────────────────────────────
 *   Solo imprime avisos cuando hay algo que revisar.
 *
 * Requiere en .env: DATABASE_URL (o DIRECT_URL) y FOOTBALL_DATA_API_KEY.
 */

import { PrismaClient, Top10Metrica, Top10Fuente } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as dotenv from 'dotenv'
import * as fs from 'fs'
import * as path from 'path'
import { normalizar, normalizarEquipo } from '../../src/lib/normalizacion/normalizarEquipo'

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') })
dotenv.config()

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL
if (!connectionString) throw new Error('Falta DIRECT_URL o DATABASE_URL')

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) })

/** código -> [nombre, empieza y acaba el mismo año] */
const COMPETICIONES: Record<string, [string, boolean]> = {
  PD: ['La Liga', false],
  PL: ['Premier League', false],
  BL1: ['Bundesliga', false],
  SA: ['Serie A', false],
  FL1: ['Ligue 1', false],
  DED: ['Eredivisie', false],
  PPL: ['Primeira Liga', false],
  ELC: ['Championship', false],
  CL: ['Champions League', false],
  BSA: ['Serie A (Brasil)', true],
  WC: ['Mundial FIFA', true],
  EC: ['Eurocopa', true],
}
const SELECCIONES = new Set(['WC', 'EC'])

interface Entrada {
  nombre: string
  externalId?: string
  goles: number
  /** Texto formateado a mostrar en vez de `goles` (ej. edad "40 años, 4 meses y 17 días"). */
  valorTexto?: string
  equipo?: string
}

interface Fuente {
  codigo: string
  nombreCompeticion: string
  externalIdCompeticion?: string
  temporada: string
  titulo: string
  descripcion?: string
  origen: Top10Fuente
  // Casi siempre GOLES (lo único que soportaba la API). Los JSON manuales
  // pueden declarar otra con "metrica" -- ver desdeArchivo().
  metrica: Top10Metrica
  // Nombre del club si este ranking es "de un club" (ej. traspasos del
  // Real Madrid) en vez de "de una competición entera". Se resuelve a un
  // Team real más abajo, igual que el equipo de cada entrada.
  club?: string
  entradas: Entrada[]
}

/** Desglose de edad tal cual se escribe a mano en el JSON. */
interface EdadJson {
  anios: number
  meses?: number
  dias?: number
}

function esEdadJson(v: unknown): v is EdadJson {
  return typeof v === 'object' && v !== null && typeof (v as EdadJson).anios === 'number'
}

function formatearEdad(e: EdadJson): string {
  const partes: string[] = [`${e.anios} ${e.anios === 1 ? 'año' : 'años'}`]
  if (e.meses) partes.push(`${e.meses} ${e.meses === 1 ? 'mes' : 'meses'}`)
  if (e.dias) partes.push(`${e.dias} ${e.dias === 1 ? 'día' : 'días'}`)
  if (partes.length === 1) return partes[0]
  return `${partes.slice(0, -1).join(', ')} y ${partes[partes.length - 1]}`
}

// Solo para tener ALGÚN número en Top10Entry.valor (el campo es Float y
// no admite null) -- el orden real de la tabla lo decide la posición de
// la entrada en el array del JSON, no este número, así que basta con que
// sea razonablemente comparable (más años = número más alto). No se usa
// para nada más: lo que se enseña en pantalla es `valorTexto`.
function edadANumeroOrdenable(e: EdadJson): number {
  return e.anios * 365 + (e.meses ?? 0) * 30 + (e.dias ?? 0)
}

/** Lo que devuelve la API por cada goleador */
interface ApiScorer {
  player: { id: number; name: string }
  team: { name: string }
  goals: number
}

/** Lo que hay en cada entrada del JSON manual */
interface EntradaJson {
  nombre: string
  externalId?: string | number
  // Tres formas válidas:
  //  - número de siempre (goles, asistencias...)
  //  - { anios, meses, dias } si la métrica del archivo es "EDAD"
  //  - un string ya formateado a mano ("80M€", "180,5 M€"...) para
  //    cualquier métrica donde un número pelado no exprese bien el dato --
  //    se guarda tal cual en `valorTexto` y se enseña así en el juego.
  valor?: number | string | EdadJson
  goles?: number
  equipo?: string
}

// ------------------------------------------------------------
// Normalización -- ver src/lib/normalizarEquipo.ts. Antes estaba
// duplicada aquí y en sync-escudos-equipos.ts; se centralizó porque
// además la usa ahora findOrCreateTeam en wikipediaSync.ts, que era el
// sitio donde en realidad nacían los equipos duplicados en Team (ver
// claude/pendientes-goal-arena.md, sesión "equipos duplicados").
// ------------------------------------------------------------
function temporadaTexto(anio: number, unica: boolean): string {
  return unica ? String(anio) : `${anio}-${String(anio + 1).slice(-2)}`
}

// ------------------------------------------------------------
// Fuentes
// ------------------------------------------------------------

async function desdeApi(codigo: string, anio: number): Promise<Fuente> {
  const key = process.env.FOOTBALL_DATA_API_KEY
  if (!key) throw new Error('Falta FOOTBALL_DATA_API_KEY en .env')

  const url = `https://api.football-data.org/v4/competitions/${codigo}/scorers?season=${anio}&limit=10`
  console.log(`GET ${url}`)
  const res = await fetch(url, { headers: { 'X-Auth-Token': key } })

  if (res.status === 403) {
    throw new Error(
      `403: la temporada ${anio} no entra en tu plan gratuito.\n` +
        `Escribe los datos a mano en data/top10/${codigo}-${anio}.json y usa --archivo.`
    )
  }
  if (!res.ok) throw new Error(`La API respondió ${res.status}: ${await res.text()}`)

  const d = await res.json()
  const inicio = new Date(d.season.startDate).getUTCFullYear()
  const fin = new Date(d.season.endDate).getUTCFullYear()
  const temporada = inicio === fin ? String(inicio) : `${inicio}-${String(fin).slice(-2)}`

  return {
    codigo,
    nombreCompeticion: d.competition.name,
    externalIdCompeticion: String(d.competition.id),
    temporada,
    titulo: `Máximos goleadores de ${d.competition.name} ${temporada}`,
    origen: Top10Fuente.API,
    metrica: Top10Metrica.GOLES,
    entradas: d.scorers.map((s: ApiScorer) => ({
      nombre: s.player.name,
      externalId: String(s.player.id),
      goles: s.goals,
      equipo: s.team.name,
    })),
  }
}

function desdeArchivo(ruta: string): Fuente {
  const datos = JSON.parse(fs.readFileSync(ruta, 'utf-8'))
  const codigo = String(datos.competicion).toUpperCase()
  const [nombreCompeticion, unica] = COMPETICIONES[codigo] ?? [codigo, false]

  const temporada =
    typeof datos.temporada === 'number'
      ? temporadaTexto(datos.temporada, unica)
      : String(datos.temporada)

  // Por defecto GOLES (compatible con todos los JSON que ya existían, que
  // no declaraban "metrica"). Escribe "metrica": "EDAD" en el JSON y pon
  // el "valor" de cada entrada como { "anios": 40, "meses": 4, "dias": 17 }
  // para un ranking tipo "goleadores más veteranos" -- se muestra
  // formateado ("40 años, 4 meses y 17 días") en vez de un número pelado.
  const metrica: Top10Metrica =
    typeof datos.metrica === 'string' && datos.metrica.toUpperCase() in Top10Metrica
      ? (datos.metrica.toUpperCase() as Top10Metrica)
      : Top10Metrica.GOLES

  const entradas: Entrada[] = datos.entradas.map((e: EntradaJson) => {
    const base = {
      nombre: String(e.nombre).trim(),
      externalId: e.externalId ? String(e.externalId) : undefined,
      equipo: e.equipo?.trim() || undefined,
    }

    if (esEdadJson(e.valor)) {
      return { ...base, goles: edadANumeroOrdenable(e.valor), valorTexto: formatearEdad(e.valor) }
    }

    if (typeof e.valor === 'string') {
      // Ya viene formateado a mano ("80M€"...) -- se enseña tal cual. El
      // número de aquí abajo (`goles`) es solo el "algún número" que pide
      // el campo `valor` de la base de datos (ver nota en el schema); el
      // orden real lo decide la posición en el array, no este número.
      return { ...base, goles: 0, valorTexto: e.valor.trim() }
    }

    return { ...base, goles: Number(e.valor ?? e.goles) }
  })

  if (entradas.some((e) => !e.nombre)) throw new Error('Hay entradas sin nombre en el JSON.')

  return {
    codigo,
    nombreCompeticion,
    temporada,
    titulo: datos.titulo?.trim() || `Máximos goleadores de ${nombreCompeticion} ${temporada}`,
    descripcion: datos.descripcion,
    origen: Top10Fuente.MANUAL,
    metrica,
    // Campo opcional nuevo en el JSON: "club": "Real Madrid CF". Si no
    // está, el ranking sigue siendo "de competición" como siempre.
    club: typeof datos.club === 'string' ? datos.club.trim() : undefined,
    entradas,
  }
}

// ------------------------------------------------------------
// Main
// ------------------------------------------------------------

async function main() {
  const args = process.argv.slice(2)
  const arg = (n: string) => args.find((a) => a.startsWith(`--${n}=`))?.split('=')[1]
  const dryRun = args.includes('--dry-run')

  const archivo = arg('archivo')
  const codigo = arg('competicion')?.toUpperCase()
  const anio = Number(arg('temporada'))
  // --club="Real Madrid CF" por CLI tiene prioridad sobre el "club" del
  // JSON, si por lo que sea se pasan los dos a la vez.
  const clubCli = arg('club')

  if (!archivo && (!codigo || !anio)) {
    throw new Error(
      'Uso:\n' +
        '  --competicion=PD --temporada=2024 [--dry-run]\n' +
        '  --archivo=data/top10/PD-2018.json [--dry-run]\n' +
        `Competiciones: ${Object.keys(COMPETICIONES).join(', ')}`
    )
  }

  const fuente = archivo ? desdeArchivo(archivo) : await desdeApi(codigo!, anio)
  if (clubCli) fuente.club = clubCli

  console.log(`\n${fuente.titulo}   [${fuente.origen}]${fuente.club ? `  (club: ${fuente.club})` : ''}\n`)
  fuente.entradas.forEach((e, i) => {
    const valorMostrado = e.valorTexto ?? `${e.goles} goles`
    console.log(`  ${String(i + 1).padStart(2)}. ${e.nombre.padEnd(26)} ${valorMostrado.padEnd(24)} ${e.equipo ?? ''}`)
  })

  // --- Jugadores: se indexan por externalId y por nombre/alias normalizados ---
  const jugadores = await prisma.player.findMany({
    select: { id: true, nombre: true, alias: true, externalId: true },
  })
  const jugPorId = new Map(jugadores.filter((j) => j.externalId).map((j) => [j.externalId!, j]))
  const jugPorNombre = new Map<string, typeof jugadores>()
  for (const j of jugadores) {
    for (const v of [j.nombre, ...j.alias]) {
      const k = normalizar(v)
      jugPorNombre.set(k, [...(jugPorNombre.get(k) ?? []), j])
    }
  }

  const resueltos: Array<{ entrada: Entrada; playerId: string; posicion: number }> = []
  const faltantes: Entrada[] = []

  for (const [i, entrada] of fuente.entradas.entries()) {
    const porId = entrada.externalId ? jugPorId.get(entrada.externalId) : undefined
    const porNombre = jugPorNombre.get(normalizar(entrada.nombre)) ?? []
    const jugador = porId ?? (porNombre.length === 1 ? porNombre[0] : undefined)

    if (porNombre.length > 1 && !porId) {
      console.warn(`  Ambiguo: "${entrada.nombre}" coincide con ${porNombre.length} jugadores.`)
    }
    if (jugador) resueltos.push({ entrada, playerId: jugador.id, posicion: i + 1 })
    else faltantes.push(entrada)
  }

  if (faltantes.length > 0) {
    console.error(`\nABORTADO: faltan ${faltantes.length} jugadores en la base de datos:\n`)
    for (const f of faltantes) {
      console.error(`  ${f.nombre}${f.externalId ? `  (externalId ${f.externalId})` : ''}`)
    }
    console.error('\nDalos de alta, o añade "externalId" a esa entrada del JSON.\n')
    process.exitCode = 1
    return
  }

  // --- Equipos: se indexan por externalId y por nombre normalizado sin ruido ---
  const equipos = await prisma.team.findMany({
    select: { id: true, nombre: true, externalId: true },
  })
  const eqPorNombre = new Map(equipos.map((e) => [normalizarEquipo(e.nombre), e.id]))

  function buscarEquipo(nombre?: string): string | null {
    if (!nombre || SELECCIONES.has(fuente.codigo)) return null
    const clave = normalizarEquipo(nombre)
    if (eqPorNombre.has(clave)) return eqPorNombre.get(clave)!

    // Fallback: uno contiene al otro ("Celta" <-> "Celta de Vigo")
    const parciales = [...eqPorNombre.entries()].filter(
      ([k]) => k.includes(clave) || clave.includes(k)
    )
    return parciales.length === 1 ? parciales[0][1] : null
  }

  /** Equipos de la BD que comparten alguna palabra larga, para sugerir */
  function sugerirEquipos(nombre: string): string[] {
    const palabras = normalizarEquipo(nombre)
      .split(' ')
      .filter((p) => p.length >= 4)
    if (palabras.length === 0) return []
    return equipos
      .filter((e) => {
        const suyas = normalizarEquipo(e.nombre).split(' ')
        return palabras.some((p) => suyas.includes(p))
      })
      .map((e) => e.nombre)
      .slice(0, 8)
  }

const sinEquipo = SELECCIONES.has(fuente.codigo)
    ? []
    : fuente.entradas.filter((e) => e.equipo && !buscarEquipo(e.equipo))

  if (sinEquipo.length > 0) {
    console.warn(`\nEquipos sin enlazar (el nombre se guarda igual, la UI no se rompe):`)
    for (const e of sinEquipo) {
      const sug = sugerirEquipos(e.equipo!)
      console.warn(`  "${e.equipo}"${sug.length ? `  ->  ¿es alguno de estos? ${sug.join(' | ')}` : ''}`)
    }
    console.warn('')
  }

  // --- Club del ranking (si aplica): a diferencia del equipo de cada
  // entrada, este SÍ tiene que resolver a un Team real -- es la clave
  // que distingue este ranking de otros de la misma competición/temporada/
  // métrica, así que si no se encuentra, se aborta en vez de avisar y
  // seguir (evita crear "el ranking del club X" sin enlazar de verdad a X).
  let clubId: string | null = null
  if (fuente.club) {
    clubId = buscarEquipo(fuente.club)
    if (!clubId) {
      const sug = sugerirEquipos(fuente.club)
      console.error(`\nABORTADO: el club "${fuente.club}" no se encontró como Team.`)
      if (sug.length) console.error(`¿Es alguno de estos? ${sug.join(' | ')}`)
      console.error('Corrige el nombre, o da de alta el equipo si de verdad no existe todavía.\n')
      process.exitCode = 1
      return
    }
  }

  if (dryRun) {
    console.log('\nDRY RUN: no se ha escrito nada. Quita --dry-run para guardar.')
    return
  }

  // --- Escribir ---
  const competition = await prisma.competition.upsert({
    where: { codigo: fuente.codigo },
    update: {
      nombre: fuente.nombreCompeticion,
      ...(fuente.externalIdCompeticion ? { externalId: fuente.externalIdCompeticion } : {}),
    },
    create: {
      codigo: fuente.codigo,
      nombre: fuente.nombreCompeticion,
      externalId: fuente.externalIdCompeticion ?? null,
    },
  })

  // PlayerStat es la tabla de "goles/asistencias por temporada" -- solo
  // tiene sentido tocarla cuando el ranking de verdad es de GOLES. Para
  // otras métricas (ej. EDAD) `r.entrada.goles` no es un dato real de la
  // temporada, así que ni se escribe ahí.
  if (fuente.metrica === Top10Metrica.GOLES) {
    for (const r of resueltos) {
      const teamId = buscarEquipo(r.entrada.equipo)
      await prisma.playerStat.upsert({
        where: {
          playerId_competitionId_temporada: {
            playerId: r.playerId,
            competitionId: competition.id,
            temporada: fuente.temporada,
          },
        },
        update: { goles: r.entrada.goles, teamId },
        create: {
          playerId: r.playerId,
          competitionId: competition.id,
          temporada: fuente.temporada,
          goles: r.entrada.goles,
          teamId,
        },
      })
    }
  }

  const existente = await prisma.top10Ranking.findFirst({
    where: {
      competitionId: competition.id,
      temporada: fuente.temporada,
      metrica: fuente.metrica,
      clubId,
    },
    select: { id: true },
  })

  const datos = {
    titulo: fuente.titulo,
    descripcion: fuente.descripcion ?? null,
    totalEntradas: resueltos.length,
    fuente: fuente.origen,
  }

  const ranking = existente
    ? await prisma.top10Ranking.update({ where: { id: existente.id }, data: datos })
    : await prisma.top10Ranking.create({
        data: {
          ...datos,
          competitionId: competition.id,
          temporada: fuente.temporada,
          metrica: fuente.metrica,
          clubId,
        },
      })

  await prisma.top10Entry.deleteMany({ where: { rankingId: ranking.id } })
  await prisma.top10Entry.createMany({
    data: resueltos.map((r) => ({
      rankingId: ranking.id,
      posicion: r.posicion,
      playerId: r.playerId,
      valor: r.entrada.goles,
      valorTexto: r.entrada.valorTexto ?? null,
      equipoTexto: r.entrada.equipo ?? null,
    })),
  })

  console.log(`\n${existente ? 'Actualizado' : 'Creado'}: ${ranking.id}  (${resueltos.length} entradas)\n`)
}

main()
  .catch((e) => {
    console.error(`\n${e.message}\n`)
    process.exitCode = 1
  })
  .finally(() => prisma.$disconnect())