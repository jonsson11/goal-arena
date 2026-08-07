// src/lib/progresoLogros.ts
//
// SOLO SERVIDOR. El progreso de cada logro se calcula EN CALIENTE a
// partir de datos que ya existen (PartidaJugada, Friendship, User) --
// nunca se guarda un "progreso" duplicado en la base de datos, así que
// no hay manera de que se desincronice. Lo único persistido es qué se ha
// RECLAMADO (ver LogroReclamado en el schema).

import { prisma } from "@/lib/prisma";
import { LOGROS, EXP_POR_TIER, type Logro, type EstadoLogro, type LogroConProgreso } from "./logros";
import { aplicarExperiencia, type RespuestaPartida } from "./experiencia";

type Contadores = {
  nivel: number;
  amigos: number;
  multijugadorJugadas: number;
  victoriasGrid: number;
  victoriasTop10: number;
  victoriasGridDificil: number;
  rachaMaxima: number;
  victoriasMultijugador: number;
  victoriasTotales: number;
  partidasTotales: number;
  jugoAmbosJuegos: boolean;
};

// Una sola pasada sobre TODAS las partidas del usuario (traídas en una
// única consulta) en vez de una consulta count() por cada contador --
// para un usuario normal son pocas filas, así que es más barato hacerlo
// así que lanzar 8-10 queries distintas a la base de datos.
async function calcularContadores(userId: string): Promise<Contadores> {
  const [usuario, amigosCount, partidas] = await Promise.all([
    prisma.user.findUniqueOrThrow({ where: { id: userId }, select: { nivel: true, rachaMaxima: true } }),
    prisma.friendship.count({
      where: { estado: "ACEPTADA", OR: [{ solicitanteId: userId }, { receptorId: userId }] },
    }),
    prisma.partidaJugada.findMany({ where: { userId }, select: { juego: true, modo: true, resultado: true } }),
  ]);

  let multijugadorJugadas = 0;
  let victoriasGrid = 0;
  let victoriasTop10 = 0;
  let victoriasGridDificil = 0;
  let victoriasMultijugador = 0;
  let victoriasTotales = 0;
  let jugoGrid = false;
  let jugoTop10 = false;

  for (const p of partidas) {
    // "-online" es el sufijo que usa el multijugador para el campo `modo`
    // (ver finalizarPartidaSiToca en salas.ts, p. ej. "dificil-online")
    // -- así se distingue una partida multijugador de una individual sin
    // necesitar un campo aparte.
    const esOnline = p.modo?.endsWith("-online") ?? false;
    const esVictoria = p.resultado === "VICTORIA";

    if (p.juego === "GRID") jugoGrid = true;
    if (p.juego === "TOP10") jugoTop10 = true;

    if (esOnline) multijugadorJugadas++;

    if (esVictoria) {
      victoriasTotales++;
      if (esOnline) victoriasMultijugador++;
      if (p.juego === "GRID") {
        victoriasGrid++;
        if (p.modo?.includes("dificil")) victoriasGridDificil++;
      }
      if (p.juego === "TOP10") victoriasTop10++;
    }
  }

  return {
    nivel: usuario.nivel,
    amigos: amigosCount,
    multijugadorJugadas,
    victoriasGrid,
    victoriasTop10,
    victoriasGridDificil,
    rachaMaxima: usuario.rachaMaxima,
    victoriasMultijugador,
    victoriasTotales,
    partidasTotales: partidas.length,
    jugoAmbosJuegos: jugoGrid && jugoTop10,
  };
}

// Traduce la categoría (o, para "especial", el id concreto) al contador
// que le corresponde -- un único sitio que sabe "de qué trata" cada
// logro, para que calcularContadores y reclamarLogro nunca se
// desincronicen sobre qué cuenta como progreso de cada uno.
function valorParaLogro(logro: Logro, c: Contadores): number {
  switch (logro.categoria) {
    case "nivel":
      return c.nivel;
    case "amigos":
      return c.amigos;
    case "multijugador-jugadas":
      return c.multijugadorJugadas;
    case "victorias-grid":
      return c.victoriasGrid;
    case "victorias-top10":
      return c.victoriasTop10;
    case "dificil":
      return c.victoriasGridDificil;
    case "racha":
      return c.rachaMaxima;
    case "victorias-multijugador":
      return c.victoriasMultijugador;
    case "especial":
      if (logro.id === "primera-victoria") return c.victoriasTotales;
      if (logro.id === "explorador") return c.jugoAmbosJuegos ? 1 : 0;
      if (logro.id === "cien-no-es-nada") return c.partidasTotales;
      return 0;
  }
}

export async function obtenerLogrosConProgreso(userId: string): Promise<LogroConProgreso[]> {
  const [contadores, reclamados] = await Promise.all([
    calcularContadores(userId),
    prisma.logroReclamado.findMany({ where: { userId } }),
  ]);

  const reclamadosPorId = new Map(reclamados.map((r) => [r.logroId, r]));

  return LOGROS.map((logro) => {
    const progresoReal = valorParaLogro(logro, contadores);
    const reclamado = reclamadosPorId.get(logro.id);

    const estado: EstadoLogro = reclamado ? "reclamado" : progresoReal >= logro.umbral ? "reclamable" : "bloqueado";

    return {
      ...logro,
      progreso: Math.min(progresoReal, logro.umbral),
      estado,
      expGanada: reclamado?.expGanada,
      reclamadoEn: reclamado?.reclamadoEn.toISOString(),
    };
  });
}

export type ResultadoReclamo =
  | { ok: true; respuesta: RespuestaPartida }
  | { ok: false; error: string };

// Reclama un logro: comprueba de nuevo en el servidor (nunca te fías de
// lo que diga el cliente) que de verdad está desbloqueado y que no se
// había reclamado antes, aplica la EXP y dejará constancia en
// LogroReclamado -- todo en una transacción, con la fila de usuario
// bloqueada mientras se aplica la EXP (mismo patrón que
// finalizarPartidaSiToca en salas.ts), para que dos reclamos casi
// simultáneos del mismo usuario no se pisen.
export async function reclamarLogro(userId: string, logroId: string): Promise<ResultadoReclamo> {
  const logro = LOGROS.find((l) => l.id === logroId);
  if (!logro) return { ok: false, error: "Ese logro no existe." };

  const yaReclamado = await prisma.logroReclamado.findUnique({
    where: { userId_logroId: { userId, logroId } },
  });
  if (yaReclamado) return { ok: false, error: "Ya has reclamado ese logro." };

  const contadores = await calcularContadores(userId);
  if (valorParaLogro(logro, contadores) < logro.umbral) {
    return { ok: false, error: "Todavía no has desbloqueado ese logro." };
  }

  const expGanada = EXP_POR_TIER[logro.tier];

  return prisma.$transaction(async (tx) => {
    const filasUsuario = await tx.$queryRaw<Array<{ nivel: number; xpActual: number; xpSiguienteNivel: number }>>`
      SELECT nivel, "xpActual", "xpSiguienteNivel" FROM "User" WHERE id = ${userId} FOR UPDATE`;
    const actual = filasUsuario[0];
    if (!actual) return { ok: false, error: "No se ha encontrado tu usuario." };

    const estadoAntes = { nivel: actual.nivel, xpActual: actual.xpActual, xpSiguienteNivel: actual.xpSiguienteNivel };
    const estadoDespues = aplicarExperiencia(estadoAntes, expGanada);

    await tx.user.update({
      where: { id: userId },
      data: {
        nivel: estadoDespues.nivel,
        xpActual: estadoDespues.xpActual,
        xpSiguienteNivel: estadoDespues.xpSiguienteNivel,
      },
    });

    await tx.logroReclamado.create({ data: { userId, logroId, expGanada } });

    // Mismo tipo RespuestaPartida que ya usa el modo individual y el
    // multijugador -- así el cartel de "reclamar logro" puede reutilizar
    // <ExperienciaGanada> tal cual, sin inventar una animación nueva.
    // Sin bono de rapidez ni bono diario aquí (no tienen sentido para un
    // logro), así que van a 0/false.
    const respuesta: RespuestaPartida = {
      estadoAntes,
      estadoDespues,
      expBase: expGanada,
      bonusTiempoPct: 0,
      expTiempoExtra: 0,
      bonusDiario: false,
      expGanada,
    };

    return { ok: true, respuesta };
  });
}