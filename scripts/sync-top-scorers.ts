/**
 * scripts/sync-top-scorers.ts
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
 *   npx tsx scripts/sync-top-scorers.ts --competicion=PD --temporada=2024
 *   npx tsx scripts/sync-top-scorers.ts --archivo=data/top10/PD-2018.json
 *
 *   --dry-run  enseña lo que haría sin escribir nada. Úsalo siempre antes.
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

interface Entrada {
  nombre: string
  externalId?: string
  goles: number
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
  entradas: Entrada[]
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
  valor?: number
  goles?: number
  equipo?: string
}

// ------------------------------------------------------------
// Normalización
// ------------------------------------------------------------

/** "Ángel Di María" -> "angel di maria" */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * "RCD Espanyol de Barcelona" -> "espanyol barcelona".
 * Solo siglas y palabras genéricas. Nada que distinga a un club de otro:
 * "atletico" o "sociedad" NO van aquí, o Atlético Madrid y Real Madrid
 * acabarían siendo el mismo equipo.
 */
const RUIDO_CLUB = new Set([
  'fc', 'cf', 'rc', 'rcd', 'cd', 'ud', 'sd', 'ca', 'ac', 'as', 'sc', 'sl',
  'sad', 'club', 'de', 'del', 'futbol', 'football',
])
function normalizarEquipo(nombre: string): string {
  return normalizar(nombre)
    .split(' ')
    .filter((p) => p && !RUIDO_CLUB.has(p))
    .join(' ')
}

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

  const entradas: Entrada[] = datos.entradas.map((e: EntradaJson) => ({
    nombre: String(e.nombre).trim(),
    externalId: e.externalId ? String(e.externalId) : undefined,
    goles: Number(e.valor ?? e.goles),
    equipo: e.equipo?.trim() || undefined,
  }))

  if (entradas.some((e) => !e.nombre)) throw new Error('Hay entradas sin nombre en el JSON.')

  return {
    codigo,
    nombreCompeticion,
    temporada,
    titulo: datos.titulo?.trim() || `Máximos goleadores de ${nombreCompeticion} ${temporada}`,
    descripcion: datos.descripcion,
    origen: Top10Fuente.MANUAL,
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

  if (!archivo && (!codigo || !anio)) {
    throw new Error(
      'Uso:\n' +
        '  --competicion=PD --temporada=2024 [--dry-run]\n' +
        '  --archivo=data/top10/PD-2018.json [--dry-run]\n' +
        `Competiciones: ${Object.keys(COMPETICIONES).join(', ')}`
    )
  }

  const fuente = archivo ? desdeArchivo(archivo) : await desdeApi(codigo!, anio)

  console.log(`\n${fuente.titulo}   [${fuente.origen}]\n`)
  fuente.entradas.forEach((e, i) => {
    console.log(
      `  ${String(i + 1).padStart(2)}. ${e.nombre.padEnd(26)} ${String(e.goles).padStart(3)} goles   ${e.equipo ?? ''}`
    )
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
    if (!nombre) return null
    const clave = normalizarEquipo(nombre)
    if (eqPorNombre.has(clave)) return eqPorNombre.get(clave)!

    // Fallback: uno contiene al otro ("Celta" <-> "Celta de Vigo")
    const parciales = [...eqPorNombre.entries()].filter(
      ([k]) => k.includes(clave) || clave.includes(k)
    )
    return parciales.length === 1 ? parciales[0][1] : null
  }

  const sinEquipo = fuente.entradas.filter((e) => e.equipo && !buscarEquipo(e.equipo))
  if (sinEquipo.length > 0) {
    console.warn(`\nEquipos que no he encontrado en la BD (se guarda solo el nombre):`)
    for (const e of sinEquipo) console.warn(`  "${e.equipo}"`)
    console.warn(`Equipos en tu BD: ${equipos.map((e) => e.nombre).join(', ')}\n`)
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
      update: { goles: r.entrada.goles, ...(teamId ? { teamId } : {}) },
      create: {
        playerId: r.playerId,
        competitionId: competition.id,
        temporada: fuente.temporada,
        goles: r.entrada.goles,
        teamId,
      },
    })
  }

  const existente = await prisma.top10Ranking.findFirst({
    where: {
      competitionId: competition.id,
      temporada: fuente.temporada,
      metrica: Top10Metrica.GOLES,
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
          metrica: Top10Metrica.GOLES,
        },
      })

  await prisma.top10Entry.deleteMany({ where: { rankingId: ranking.id } })
  await prisma.top10Entry.createMany({
    data: resueltos.map((r) => ({
      rankingId: ranking.id,
      posicion: r.posicion,
      playerId: r.playerId,
      valor: r.entrada.goles,
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