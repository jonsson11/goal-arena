// src/lib/salas.ts
//
// SOLO SERVIDOR. Helpers compartidos por las rutas de /api/salas/*.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { Sala, JuegoMultijugador, ColocacionPropia, RivalPartida, EstadoPartida } from "@/features/multijugador/type";
import type { Dificultad } from "@/features/games/shared/types";
import type { Tablero } from "@/features/games/grid/type";
import {
  estaDisponibleBonusDiario,
  calcularExperienciaMultijugador,
  aplicarExperiencia,
  type ResultadoMultijugador,
  type RespuestaPartida,
} from "@/lib/experiencia";

// Sin 0/O, 1/I/L, ni vocales que formen palabras raras por accidente --
// alfabeto reducido a propósito para que un código se pueda leer en voz
// alta o escribir a mano sin ambigüedad ("¿esto es una O o un cero?").
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGITUD_CODIGO = 6;

function generarCodigoAlAzar(): string {
  let codigo = "";
  for (let i = 0; i < LONGITUD_CODIGO; i++) {
    codigo += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
  }
  return codigo;
}

// Reintenta si por casualidad choca con uno ya existente -- con 32^6 (~10^9)
// combinaciones posibles la colisión es rarísima, pero hay que cubrirla.
export async function generarCodigoSalaUnico(): Promise<string> {
  for (let intento = 0; intento < 10; intento++) {
    const codigo = generarCodigoAlAzar();
    const existente = await prisma.sala.findUnique({ where: { codigo } });
    if (!existente) return codigo;
  }
  throw new Error("No se pudo generar un código de sala único, inténtalo de nuevo.");
}

// Tipo de una Sala de Prisma con sus jugadores (y el User de cada uno) ya
// incluidos -- lo que devuelve prisma.sala.findUnique({ include: { jugadores:
// { include: { user: true } } } }). Definido aparte para no repetir el
// `include` en cada sitio que llama a serializarSala.
const INCLUDE_JUGADORES = {
  jugadores: { include: { user: true }, orderBy: { unidoEn: "asc" as const } },
} satisfies Prisma.SalaInclude;

type SalaConJugadores = Prisma.SalaGetPayload<{ include: typeof INCLUDE_JUGADORES }>;

export const SALA_INCLUDE_JUGADORES = INCLUDE_JUGADORES;

// Convierte la fila de Prisma (con jugadores) al tipo que consume el
// cliente -- una única fuente de verdad para esta conversión, usada por
// todas las rutas de /api/salas/* que devuelven el estado de una sala.
export function serializarSala(sala: SalaConJugadores): Sala {
  return {
    codigo: sala.codigo,
    juego: sala.juego as JuegoMultijugador,
    dificultad: (sala.dificultad as Dificultad | null) ?? null,
    maxJugadores: sala.maxJugadores,
    estado: sala.estado,
    creadorId: sala.creadorId,
    jugadores: sala.jugadores.map((sj) => ({
      id: sj.user.id,
      nombre: sj.user.nombre,
      avatar: sj.user.avatar,
      avatarTipo: sj.user.avatarTipo === "FOTO" ? ("foto" as const) : ("emoji" as const),
      listo: sj.listo,
      esCreador: sj.user.id === sala.creadorId,
    })),
  };
}


// Rellena `amistad` en cada jugador (menos en uno mismo) según la
// relación real con quien está preguntando -- solo lo usa GET
// /api/salas/[codigo], que es la ruta que hace polling la sala de espera
// (ver comentario en el tipo JugadorSala). Una sola consulta con OR para
// todos los rivales a la vez, en vez de una por jugador.
export async function enriquecerConAmistad(sala: Sala, miUserId: string): Promise<Sala> {
  const otrosIds = sala.jugadores.map((j) => j.id).filter((id) => id !== miUserId);
  if (otrosIds.length === 0) return sala;

  const amistades = await prisma.friendship.findMany({
    where: {
      OR: [
        { solicitanteId: miUserId, receptorId: { in: otrosIds } },
        { receptorId: miUserId, solicitanteId: { in: otrosIds } },
      ],
    },
  });

  const estadoPorOtroId = new Map<string, "AMIGOS" | "PENDIENTE">();
  for (const amistad of amistades) {
    const otroId = amistad.solicitanteId === miUserId ? amistad.receptorId : amistad.solicitanteId;
    estadoPorOtroId.set(otroId, amistad.estado === "ACEPTADA" ? "AMIGOS" : "PENDIENTE");
  }

  return {
    ...sala,
    jugadores: sala.jugadores.map((j) => ({
      ...j,
      amistad: j.id === miUserId ? "YO" : (estadoPorOtroId.get(j.id) ?? "NINGUNA"),
    })),
  };
}

// ────────────────────────────────────────────────────────────────
// Partida en directo (Fase 2, 06/08/2026)
// ────────────────────────────────────────────────────────────────

// Duración de la RONDA (timer duro, cuenta atrás compartida) -- distinto
// concepto de DURACION_ESPERADA_SEGUNDOS de experiencia.ts (esa es la
// "duración típica" que se usa como referencia para el bono de rapidez
// del modo individual, no un límite duro). Aquí sí hace falta un límite
// duro porque hay un timer real de por medio; se da bastante más margen
// que la duración típica individual para que sea un reto justo y no un
// cronómetro casi imposible de ganar por tiempo.
const DURACION_RONDA_SEGUNDOS: Record<Dificultad, number> = {
  facil: 180,
  medio: 240,
  dificil: 360,
};

export function duracionRondaSegundos(dificultad: Dificultad): number {
  return DURACION_RONDA_SEGUNDOS[dificultad];
}

type SalaJugadorConUser = Prisma.SalaJugadorGetPayload<{ include: { user: true } }>;

/** Resultado + segundos (solo relevante en victoria por finalización, no
 * por timeout) que le corresponde a cada jugador al cerrar la partida.
 * Centralizado aquí para que tanto el cierre "por completar" como el
 * cierre "por timeout" (ver finalizarPartidaSiToca) usen exactamente la
 * misma regla de desempate/empate. */
function calcularResultados(
  jugadores: SalaJugadorConUser[],
  empezadaEn: Date
): Map<string, { resultado: ResultadoMultijugador; segundos: number }> {
  const resultados = new Map<string, { resultado: ResultadoMultijugador; segundos: number }>();

  const completados = jugadores.filter((sj) => sj.celdasResueltas >= 9 && sj.terminadaEn);
  if (completados.length > 0) {
    // Alguien completó las 9 -- gana quien lo hizo antes (en la práctica
    // casi siempre habrá solo uno, porque la partida se cierra en cuanto
    // el primero llega a 9; esto es solo una red de seguridad ante una
    // rarísima carrera entre dos peticiones casi simultáneas).
    const ganador = completados.reduce((a, b) => (a.terminadaEn! < b.terminadaEn! ? a : b));
    for (const sj of jugadores) {
      const esGanador = sj.userId === ganador.userId;
      resultados.set(sj.userId, {
        resultado: esGanador ? "victoria" : "derrota",
        segundos: esGanador ? (ganador.terminadaEn!.getTime() - empezadaEn.getTime()) / 1000 : 0,
      });
    }
    return resultados;
  }

  // Nadie completó -- se acabó el tiempo. Gana quien tenga más aciertos;
  // si varios empatan en el máximo, EMPATE para todos ellos (regla ya
  // decidida en el diseño original de Arenas, Fase 9), derrota para el
  // resto. Funciona igual de bien si el máximo es 0 (nadie acertó nada).
  const maximo = Math.max(...jugadores.map((sj) => sj.celdasResueltas));
  const enElMaximo = jugadores.filter((sj) => sj.celdasResueltas === maximo);
  for (const sj of jugadores) {
    const enMaximo = sj.celdasResueltas === maximo;
    resultados.set(sj.userId, {
      resultado: !enMaximo ? "derrota" : enElMaximo.length === 1 ? "victoria" : "empate",
      segundos: 0, // por timeout nunca hay bono de rapidez, ver calcularExperienciaMultijugador
    });
  }
  return resultados;
}

/** Comprueba si esta sala tiene que cerrarse (alguien completó, o se acabó
 * el tiempo) y, si toca, la cierra: reparte resultado + EXP a cada
 * jugador y marca la sala como FINALIZADA. Es IDEMPOTENTE y segura ante
 * llamadas concurrentes -- se llama tanto desde POST .../colocar (en
 * cuanto alguien llega a 9) como desde GET .../partida (por si se acaba
 * el tiempo sin que nadie complete, nadie más "avisa" de eso salvo el
 * propio polling). Bloquea la fila de la Sala hasta el final de la
 * transacción para que dos llamadas casi simultáneas no cierren -- y
 * repartan EXP -- la misma partida dos veces.
 */
export async function finalizarPartidaSiToca(salaId: string): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<Array<{ estado: string }>>`
      SELECT estado FROM "Sala" WHERE id = ${salaId} FOR UPDATE`;
    if (filas[0]?.estado !== "EN_CURSO") return; // ya cerrada, o no está en curso todavía

    const sala = await tx.sala.findUniqueOrThrow({ where: { id: salaId } });
    const jugadores = await tx.salaJugador.findMany({ where: { salaId }, include: { user: true } });

    const alguienCompleto = jugadores.some((sj) => sj.celdasResueltas >= 9);
    const tiempoAgotado =
      sala.empezadaEn !== null &&
      sala.duracionSegundos !== null &&
      Date.now() >= sala.empezadaEn.getTime() + sala.duracionSegundos * 1000;

    if (!alguienCompleto && !tiempoAgotado) return; // todavía no toca cerrarla

    const resultados = calcularResultados(jugadores, sala.empezadaEn!);
    const ahora = new Date();

    await tx.sala.update({ where: { id: sala.id }, data: { estado: "FINALIZADA" } });

    for (const sj of jugadores) {
      const { resultado, segundos } = resultados.get(sj.userId)!;

      // Mismo patrón que POST /api/partidas: fila de usuario bloqueada
      // hasta aplicar su EXP, para que dos finalizaciones (de salas
      // distintas) casi simultáneas para el mismo usuario no se pisen.
      const filasUsuario = await tx.$queryRaw<
        Array<{
          nivel: number;
          xpActual: number;
          xpSiguienteNivel: number;
          partidasJugadas: number;
          rachaActual: number;
          rachaMaxima: number;
          ultimoBonusDiario: Date | null;
        }>
      >`SELECT nivel, "xpActual", "xpSiguienteNivel", "partidasJugadas", "rachaActual", "rachaMaxima", "ultimoBonusDiario"
        FROM "User" WHERE id = ${sj.userId} FOR UPDATE`;
      const actual = filasUsuario[0];
      if (!actual) continue; // no debería poder pasar, pero no tumbamos el cierre de la sala por esto

      const bonusDiarioDisponible =
        resultado === "victoria" && estaDisponibleBonusDiario(actual.ultimoBonusDiario, ahora);
      const { bonusDiario, expGanada, expBase, bonusTiempoPct, expTiempoExtra } = calcularExperienciaMultijugador(
        (sala.dificultad as Dificultad) ?? "medio",
        resultado,
        segundos,
        bonusDiarioDisponible
      );

      const estadoAntes = { nivel: actual.nivel, xpActual: actual.xpActual, xpSiguienteNivel: actual.xpSiguienteNivel };
      const estadoDespues = aplicarExperiencia(estadoAntes, expGanada);

      // Mismo objeto RespuestaPartida que ya devuelve POST /api/partidas
      // en el modo individual -- guardarlo tal cual (no solo el número
      // final) es lo que permite reutilizar ExperienciaGanada.tsx sin
      // cambiar ni una línea de esa animación.
      const respuestaPartida: RespuestaPartida = {
        estadoAntes,
        estadoDespues,
        expBase,
        bonusTiempoPct,
        expTiempoExtra,
        bonusDiario,
        expGanada,
      };

      const esVictoria = resultado === "victoria";
      const nuevaRacha = esVictoria ? actual.rachaActual + 1 : 0;

      await tx.user.update({
        where: { id: sj.userId },
        data: {
          nivel: estadoDespues.nivel,
          xpActual: estadoDespues.xpActual,
          xpSiguienteNivel: estadoDespues.xpSiguienteNivel,
          partidasJugadas: actual.partidasJugadas + 1,
          rachaActual: nuevaRacha,
          rachaMaxima: Math.max(actual.rachaMaxima, nuevaRacha),
          ...(bonusDiario ? { ultimoBonusDiario: ahora } : {}),
        },
      });

      await tx.partidaJugada.create({
        data: {
          userId: sj.userId,
          // Sufijo "-online" para poder diferenciar en estadísticas más
          // adelante sin que afecte al cálculo de EXP (que solo mira la
          // dificultad base) -- ver comentario en calcularExperienciaMultijugador.
          juego: "GRID",
          modo: `${sala.dificultad}-online`,
          resultado: esVictoria ? "VICTORIA" : "DERROTA", // el schema no tiene EMPATE -- se guarda como derrota a efectos de "victorias/derrotas", el resultado real vive en SalaJugador.resultado
          expGanada,
          bonusDiario,
          jugadaEn: ahora,
        },
      });

      await tx.salaJugador.update({
        where: { id: sj.id },
        data: { resultado: resultado.toUpperCase(), experiencia: respuestaPartida },
      });
    }
  });
}

/** Construye el payload de GET /api/salas/[codigo]/partida para UN
 * usuario concreto -- llama primero a finalizarPartidaSiToca (para que un
 * timeout se resuelva aunque nadie coloque nada más), y luego arma el
 * tablero propio + el progreso (solo contador) de los rivales. */
export async function construirEstadoPartida(salaId: string, miUserId: string): Promise<EstadoPartida | null> {
  await finalizarPartidaSiToca(salaId);

  const sala = await prisma.sala.findUnique({
    where: { id: salaId },
    include: { jugadores: { include: { user: true }, orderBy: { unidoEn: "asc" } } },
  });
  if (!sala || !sala.empezadaEn || !sala.duracionSegundos) return null;

  const contenido = sala.contenido as unknown as Tablero;
  const mi = sala.jugadores.find((sj) => sj.userId === miUserId);
  if (!mi) return null;

  return {
    estado: sala.estado,
    juego: sala.juego as JuegoMultijugador,
    dificultad: (sala.dificultad as Dificultad | null) ?? null,
    condicionesFila: contenido.condicionesFila,
    condicionesColumna: contenido.condicionesColumna,
    miProgreso: (mi.progreso as unknown as ColocacionPropia[]) ?? [],
    miResultado: (mi.resultado as EstadoPartida["miResultado"]) ?? null,
    miExperiencia: (mi.experiencia as unknown as RespuestaPartida | null) ?? null,    rivales: sala.jugadores
      .filter((sj) => sj.userId !== miUserId)
      .map(
        (sj): RivalPartida => ({
          id: sj.user.id,
          nombre: sj.user.nombre,
          avatar: sj.user.avatar,
          avatarTipo: sj.user.avatarTipo === "FOTO" ? "foto" : "emoji",
          esCreador: sj.user.id === sala.creadorId,
          celdasResueltas: sj.celdasResueltas,
          completado: sj.celdasResueltas >= 9,
          resultado: (sj.resultado as RivalPartida["resultado"]) ?? null,
        })
      ),
    empezadaEn: sala.empezadaEn.toISOString(),
    duracionSegundos: sala.duracionSegundos,
  };
}