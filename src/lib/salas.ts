// src/lib/salas.ts
//
// SOLO SERVIDOR. Helpers compartidos por las rutas de /api/salas/*.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type {
  Sala,
  JuegoMultijugador,
  ColocacionPropia,
  AciertoPropioTop10,
  RivalPartida,
  EstadoPartida,
} from "@/features/multijugador/type";
import type { Dificultad } from "@/features/games/shared/types";
import type { Tablero } from "@/features/games/grid/type";
import type { RankingTop10 } from "@/features/games/top10/type";
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

// TOP10 no tiene dificultad (un solo modo, igual que el individual), así
// que su ronda online tiene una duración fija en vez de escalar como
// GRID -- 180s, el mismo tiempo que GRID fácil, decisión del usuario al
// diseñar esta fase.
export const DURACION_RONDA_TOP10_SEGUNDOS = 180;

/** Cuántos aciertos hacen falta para completar la ronda, según el juego --
 * 9 casillas fijas en GRID, el tamaño del ranking en TOP10 (siempre 10 hoy,
 * pero se lee de `contenido` en vez de asumir el número, por si el
 * catálogo de Top10Ranking cambiara de tamaño en el futuro). */
export function objetivoAciertos(juego: JuegoMultijugador, contenido: unknown): number {
  if (juego === "GRID") return 9;
  return (contenido as RankingTop10).respuestas.length;
}

// Cuenta atrás compartida antes de que arranque de verdad el timer de la
// ronda -- todos los jugadores llegan a la pantalla de partida con datos
// ya cargados (tablero, etc., aunque no visibles) y ven 3, 2, 1 hasta este
// mismo instante de servidor. Como `empezadaEn` es un reloj compartido, da
// igual la velocidad de conexión de cada uno: todos empiezan a la vez de
// verdad, no "en cuanto su cliente esté listo". Ver el uso en
// /api/salas/[codigo]/empezar (fija empezadaEn en el futuro) y en la
// pantalla de partida (dibuja el 3-2-1 mientras `ahora < empezadaEn`).
export const SEGUNDOS_CUENTA_ATRAS = 3;

type SalaJugadorConUser = Prisma.SalaJugadorGetPayload<{ include: { user: true } }>;

/** Resultado + segundos (solo relevante en victoria por finalización, no
 * por timeout) que le corresponde a cada jugador al cerrar la partida.
 * Centralizado aquí para que tanto el cierre "por completar" como el
 * cierre "por timeout" (ver finalizarPartidaSiToca) usen exactamente la
 * misma regla de desempate/empate. */
function calcularResultados(
  jugadores: SalaJugadorConUser[],
  empezadaEn: Date,
  objetivo: number
): Map<string, { resultado: ResultadoMultijugador; segundos: number }> {
  const resultados = new Map<string, { resultado: ResultadoMultijugador; segundos: number }>();

  const completados = jugadores.filter((sj) => sj.celdasResueltas >= objetivo && sj.terminadaEn);
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
 *
 * OJO rendimiento: esta función se llama en CADA poll de CADA jugador de
 * la sala (cada 1.5s, ver INTERVALO_POLLING_PARTIDA_MS) -- en una sala de
 * 8 jugadores son ~5 peticiones por segundo. Antes abría directamente la
 * transacción con `FOR UPDATE` (bloqueo de fila) en cada una de esas
 * llamadas, aunque el 99% de las veces la partida ni de lejos toca
 * cerrarla todavía -- eso serializaba peticiones que no tenían nada que
 * ver entre sí (cada una esperando a que la anterior soltara el bloqueo)
 * y era justo lo que hacía sentir la sala/partida menos fluida. Ahora se
 * hace primero una comprobación barata SIN bloqueo (dos SELECT sueltos) y
 * solo se entra en la transacción de verdad cuando de verdad hay algo que
 * cerrar (10/08/2026).
 */
export async function finalizarPartidaSiToca(salaId: string): Promise<void> {
  const previa = await prisma.sala.findUnique({
    where: { id: salaId },
    select: { estado: true, juego: true, contenido: true, empezadaEn: true, duracionSegundos: true },
  });
  if (!previa || previa.estado !== "EN_CURSO") return; // ya cerrada, o no está en curso todavía

  const tiempoAgotado =
    previa.empezadaEn !== null &&
    previa.duracionSegundos !== null &&
    Date.now() >= previa.empezadaEn.getTime() + previa.duracionSegundos * 1000;

  if (!tiempoAgotado) {
    // Si alguien ya completó el reto, lo normal es que la propia ruta que
    // colocó/acertó esa última pieza ya haya cerrado la partida al
    // instante (ver .../colocar y .../acertar) -- este chequeo es solo
    // una red de seguridad barata por si un poll se cruzó antes de que
    // eso terminara de aplicarse, así que basta con un COUNT sin bloqueo.
    const objetivo = objetivoAciertos(previa.juego as JuegoMultijugador, previa.contenido);
    const alguienCompleto = await prisma.salaJugador.findFirst({
      where: { salaId, celdasResueltas: { gte: objetivo } },
      select: { id: true },
    });
    if (!alguienCompleto) return; // todavía no toca cerrarla -- caso normal en casi todos los polls
  }

  // A partir de aquí sí puede tocar cerrar la sala de verdad: entramos en
  // la transacción con bloqueo, releyendo todo dentro de ella por si algo
  // cambió entre el chequeo barato de arriba y este punto.
  await prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<Array<{ estado: string }>>`
      SELECT estado FROM "Sala" WHERE id = ${salaId} FOR UPDATE`;
    if (filas[0]?.estado !== "EN_CURSO") return; // ya cerrada, o no está en curso todavía

    const sala = await tx.sala.findUniqueOrThrow({ where: { id: salaId } });
    const jugadores = await tx.salaJugador.findMany({ where: { salaId }, include: { user: true } });
    const objetivo = objetivoAciertos(sala.juego as JuegoMultijugador, sala.contenido);

    const alguienCompleto = jugadores.some((sj) => sj.celdasResueltas >= objetivo);
    const tiempoAgotado =
      sala.empezadaEn !== null &&
      sala.duracionSegundos !== null &&
      Date.now() >= sala.empezadaEn.getTime() + sala.duracionSegundos * 1000;

    if (!alguienCompleto && !tiempoAgotado) return; // todavía no toca cerrarla

    const resultados = calcularResultados(jugadores, sala.empezadaEn!, objetivo);
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
          juego: sala.juego,
          // Sufijo "-online" para poder diferenciar en estadísticas más
          // adelante sin que afecte al cálculo de EXP (que solo mira la
          // dificultad base) -- ver comentario en calcularExperienciaMultijugador.
          // TOP10 no tiene dificultad, así que aquí solo "online" (GRID sí,
          // "facil-online"/"medio-online"/"dificil-online").
          modo: sala.dificultad ? `${sala.dificultad}-online` : "online",
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

  const mi = sala.jugadores.find((sj) => sj.userId === miUserId);
  if (!mi) return null;

  const juego = sala.juego as JuegoMultijugador;
  const objetivo = objetivoAciertos(juego, sala.contenido);

  const comun = {
    estado: sala.estado,
    miResultado: (mi.resultado as EstadoPartida["miResultado"]) ?? null,
    miExperiencia: (mi.experiencia as unknown as RespuestaPartida | null) ?? null,
    rivales: sala.jugadores
      .filter((sj) => sj.userId !== miUserId)
      .map(
        (sj): RivalPartida => ({
          id: sj.user.id,
          nombre: sj.user.nombre,
          avatar: sj.user.avatar,
          avatarTipo: sj.user.avatarTipo === "FOTO" ? "foto" : "emoji",
          esCreador: sj.user.id === sala.creadorId,
          celdasResueltas: sj.celdasResueltas,
          completado: sj.celdasResueltas >= objetivo,
          resultado: (sj.resultado as RivalPartida["resultado"]) ?? null,
        })
      ),
    empezadaEn: sala.empezadaEn.toISOString(),
    duracionSegundos: sala.duracionSegundos,
    objetivo,
  };

  if (juego === "TOP10") {
    const contenido = sala.contenido as unknown as RankingTop10;
    return {
      ...comun,
      juego: "TOP10",
      dificultad: null,
      titulo: contenido.titulo,
      descripcion: contenido.descripcion,
      miProgreso: (mi.progreso as unknown as AciertoPropioTop10[]) ?? [],
    };
  }

  const contenido = sala.contenido as unknown as Tablero;
  return {
    ...comun,
    juego: "GRID",
    dificultad: (sala.dificultad as Dificultad | null) ?? "medio",
    condicionesFila: contenido.condicionesFila,
    condicionesColumna: contenido.condicionesColumna,
    miProgreso: (mi.progreso as unknown as ColocacionPropia[]) ?? [],
  };
}