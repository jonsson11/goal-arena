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
import type { PartidaGenerada, PasoCadena } from "@/features/games/linkplayers/type";
import {
  estaDisponibleBonusDiario,
  calcularExperienciaMultijugador,
  aplicarExperiencia,
  type ResultadoMultijugador,
  type RespuestaPartida,
} from "@/lib/experiencia";
import { calcularCambioTrofeos, aplicarCambioTrofeos, type ResultadoRanked } from "@/lib/trofeos";

// SalaJugador.resultado se guarda en MAYÚSCULAS ("VICTORIA"/"DERROTA"/
// "EMPATE", ver el cierre de finalizarPartidaSiToca más abajo) pero
// ResultadoMultijugador (experiencia.ts) usa minúsculas -- este mapa evita
// escribir el `.toUpperCase()` a mano en dos sitios distintos y que se
// desincronicen. `calcularCambioTrofeos` (trofeos.ts) espera el mismo
// formato en mayúsculas que ya se guarda en BD.
const RESULTADO_A_RANKED: Record<ResultadoMultijugador, ResultadoRanked> = {
  victoria: "VICTORIA",
  derrota: "DERROTA",
  empate: "EMPATE",
};

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
 * catálogo de Top10Ranking cambiara de tamaño en el futuro), y en
 * LINKPLAYERS los Steps mínimos reales entre inicial y final (menos uno,
 * para hablar en "jugadores intermedios" como el resto de la UI, ver
 * LinkPlayersGame.tsx). OJO (12/08/2026, Entrega 2): en LINKPLAYERS este
 * número es solo INFORMATIVO -- a diferencia de GRID/TOP10, la cadena
 * puede completarse con más Steps que el mínimo, así que "completado" ya
 * NO se decide comparando contra este objetivo (ver el comentario de
 * `terminadaEn` en calcularResultados/finalizarPartidaSiToca más abajo). */
export function objetivoAciertos(juego: JuegoMultijugador, contenido: unknown): number {
  if (juego === "GRID") return 9;
  if (juego === "LINKPLAYERS") return Math.max((contenido as PartidaGenerada).distanciaMinima - 1, 0);
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
// Margen de seguridad (12/08/2026, arreglo de sincronización): si pasa
// este tiempo desde que la sala pasó a EN_CURSO sin que TODOS hayan
// cargado la pantalla de partida (alguien cerró la pestaña, se le cortó
// la conexión...), se arranca la cuenta atrás igualmente con quien esté.
// Sin esto, un jugador que nunca llega a cargar dejaría la sala colgada
// para siempre en "esperando a los demás".
export const SEGUNDOS_LIMITE_CARGA = 15;

type SalaJugadorConUser = Prisma.SalaJugadorGetPayload<{ include: { user: true } }>;

function calcularResultados(
  jugadores: SalaJugadorConUser[],
  empezadaEn: Date
): Map<string, { resultado: ResultadoMultijugador; segundos: number }> {
  const resultados = new Map<string, { resultado: ResultadoMultijugador; segundos: number }>();

  // Generalizado (12/08/2026, Entrega 2 -- LinkPlayers multijugador): antes
  // comparaba `celdasResueltas >= objetivo`, que en GRID/TOP10 equivale
  // exactamente a `terminadaEn` (solo se fija en el mismo momento en que se
  // alcanza el objetivo, ver .../colocar y .../acertar) pero en LinkPlayers
  // NO hay un número fijo de aciertos que marque la meta (la cadena puede
  // completarse con más Steps que el mínimo) -- `terminadaEn` por sí solo
  // ya es la fuente de verdad de "completó el reto", para los tres juegos.
  const completados = jugadores.filter((sj) => sj.terminadaEn !== null);
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
 * ver entre sí (cada una esperando a que la anterior soltara el bloqueo).
 * Ahora se hace primero una comprobación barata SIN bloqueo (dos SELECT
 * sueltos) y solo se entra en la transacción de verdad cuando de verdad
 * hay algo que cerrar.
 */

/** Marca a `userId` como "ya cargó la pantalla de partida" (con solo que
 * su cliente llame a esto -- en la práctica, con que haga polling a GET
 * /api/salas/[codigo]/partida, no hace falta ninguna petición aparte) y,
 * si con esto YA están todos cargados (o se agotó el margen de seguridad,
 * ver SEGUNDOS_LIMITE_CARGA), fija `Sala.empezadaEn` para que arranque la
 * cuenta atrás 3-2-1 de verdad, a la vez para todos.
 *
 * Es IDEMPOTENTE y segura ante llamadas concurrentes -- mismo patrón que
 * finalizarPartidaSiToca: una comprobación barata sin bloqueo primero, y
 * solo se entra en una transacción con bloqueo de fila cuando de verdad
 * toca fijar `empezadaEn`. Se llama desde construirEstadoPartida, ANTES de
 * leer el estado fresco de la sala. */
export async function marcarCargadoYArrancarCuentaAtrasSiToca(salaId: string, userId: string): Promise<void> {
  const sala = await prisma.sala.findUnique({
    where: { id: salaId },
    select: { estado: true, empezadaEn: true, enCursoDesde: true },
  });
  if (!sala || sala.estado !== "EN_CURSO" || sala.empezadaEn !== null) return;

  await prisma.salaJugador.updateMany({
    where: { salaId, userId, cargado: false },
    data: { cargado: true },
  });

  const jugadores = await prisma.salaJugador.findMany({ where: { salaId }, select: { cargado: true } });
  const todosCargados = jugadores.every((sj) => sj.cargado);
  const seAgotoElMargen =
    sala.enCursoDesde !== null && Date.now() - sala.enCursoDesde.getTime() >= SEGUNDOS_LIMITE_CARGA * 1000;

  if (!todosCargados && !seAgotoElMargen) return;

  await prisma.$transaction(async (tx) => {
    const filas = await tx.$queryRaw<Array<{ empezadaEn: Date | null }>>`
      SELECT "empezadaEn" FROM "Sala" WHERE id = ${salaId} FOR UPDATE`;
    if (filas.length === 0 || filas[0].empezadaEn !== null) return;

    await tx.sala.update({
      where: { id: salaId },
      data: { empezadaEn: new Date(Date.now() + SEGUNDOS_CUENTA_ATRAS * 1000) },
    });
  });
}

export async function finalizarPartidaSiToca(salaId: string): Promise<void> {
  const previa = await prisma.sala.findUnique({
    where: { id: salaId },
    select: { estado: true, juego: true, contenido: true, empezadaEn: true, duracionSegundos: true },
  });
  if (!previa || previa.estado !== "EN_CURSO") return; // ya cerrada, o no está en curso todavía

  const yaTocaCerrar =
    previa.empezadaEn !== null &&
    previa.duracionSegundos !== null &&
    Date.now() >= previa.empezadaEn.getTime() + previa.duracionSegundos * 1000;

  if (!yaTocaCerrar) {
// Si alguien ya completó el reto, lo normal es que la propia ruta que
    // colocó/acertó/enlazó esa última pieza ya haya cerrado la partida al
    // instante (ver .../colocar, .../acertar y .../enlazar) -- este
    // chequeo es solo una red de seguridad barata por si un poll se cruzó
    // antes de que eso terminara de aplicarse, así que basta con un COUNT
    // sin bloqueo. Contra `terminadaEn` en vez de `celdasResueltas` (ver
    // comentario largo en calcularResultados) -- funciona igual para los
    // tres juegos, sin tener que leer `contenido` aquí.
    const alguienCompletoYa = await prisma.salaJugador.findFirst({
      where: { salaId, terminadaEn: { not: null } },
      select: { id: true },
    });
    if (!alguienCompletoYa) return; // todavía no toca cerrarla -- caso normal en casi todos los polls
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

    const alguienCompleto = jugadores.some((sj) => sj.terminadaEn !== null);
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
          trofeos: number;
        }>
      >`SELECT nivel, "xpActual", "xpSiguienteNivel", "partidasJugadas", "rachaActual", "rachaMaxima", "ultimoBonusDiario", trofeos
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

      // Trofeos (solo Salas competitivas, Fase 9) -- sistema totalmente
      // aparte del nivel/EXP de arriba, ninguno de los dos afecta al otro.
      // `trofeosAlEmpezar` de AMBOS jugadores se fijó al crear la Sala
      // (ver intentarCrearSalaCompetitiva en src/lib/ranked.ts), así que
      // el cálculo Elo usa esa foto fija en vez del valor en vivo de
      // `User.trofeos` -- determinista pase lo que pase entre medias.
      // Ranked es siempre 1vs1, así que basta con buscar "el otro" jugador
      // de esta misma Sala.
      let cambioTrofeos: number | null = null;
      if (sala.competitiva) {
        const rival = jugadores.find((otro) => otro.userId !== sj.userId);
        if (rival && sj.trofeosAlEmpezar !== null && rival.trofeosAlEmpezar !== null) {
          cambioTrofeos = calcularCambioTrofeos(
            sj.trofeosAlEmpezar,
            rival.trofeosAlEmpezar,
            RESULTADO_A_RANKED[resultado]
          );
        }
      }
      const nuevosTrofeos = cambioTrofeos !== null ? aplicarCambioTrofeos(actual.trofeos, cambioTrofeos) : null;

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
          ...(nuevosTrofeos !== null ? { trofeos: nuevosTrofeos } : {}),
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
        data: {
          resultado: resultado.toUpperCase(),
          experiencia: respuestaPartida,
          ...(cambioTrofeos !== null ? { trofeosCambio: cambioTrofeos } : {}),
        },
      });
    }
  });
}

/** Construye el payload de GET /api/salas/[codigo]/partida para UN
 * usuario concreto -- llama primero a finalizarPartidaSiToca (para que un
 * timeout se resuelva aunque nadie coloque nada más), y luego arma el
 * tablero propio + el progreso (solo contador) de los rivales. */
export async function construirEstadoPartida(salaId: string, miUserId: string): Promise<EstadoPartida | null> {
  await marcarCargadoYArrancarCuentaAtrasSiToca(salaId, miUserId);
  await finalizarPartidaSiToca(salaId);

  const sala = await prisma.sala.findUnique({
    where: { id: salaId },
    include: { jugadores: { include: { user: true }, orderBy: { unidoEn: "asc" } } },
  });
  if (!sala || !sala.duracionSegundos) return null;

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
          completado: sj.terminadaEn !== null,
          resultado: (sj.resultado as RivalPartida["resultado"]) ?? null,
        })
      ),
    empezadaEn: sala.empezadaEn ? sala.empezadaEn.toISOString() : null,
    duracionSegundos: sala.duracionSegundos,
    objetivo,
    cargados: sala.jugadores.filter((sj) => sj.cargado).length,
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
      // Solo la nacionalidad de cada posición, como pista visible desde
      // el principio -- igual que el Top10 de Un Jugador -- SIN el
      // nombre/valor real, que sigue sin mandarse hasta que se acierta
      // (ver el comentario de seguridad en EstadoPartidaTop10).
      pistasNacionalidad: contenido.respuestas.map((r) => r.nacionalidad ?? null),
    };
  }

  if (juego === "LINKPLAYERS") {
    const contenido = sala.contenido as unknown as PartidaGenerada;
    // `SalaJugador.progreso` guarda la cadena SIN el jugador inicial (igual
    // que el resto de juegos: "progreso" es solo lo que YO he ido
    // añadiendo, ver .../enlazar) -- aquí se le antepone para que el
    // cliente reciba la cadena ya completa y no tenga que reconstruirla.
    const miProgreso = (mi.progreso as unknown as PasoCadena[]) ?? [];
    return {
      ...comun,
      juego: "LINKPLAYERS",
      dificultad: (sala.dificultad as Dificultad | null) ?? "medio",
      jugadorInicial: contenido.jugadorInicial,
      jugadorFinal: contenido.jugadorFinal,
      distanciaMinima: contenido.distanciaMinima,
      miCadena: [{ jugador: contenido.jugadorInicial }, ...miProgreso],
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