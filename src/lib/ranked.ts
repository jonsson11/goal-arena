// src/lib/ranked.ts
//
// SOLO SERVIDOR. Helpers de Grid Ranked (Fase 9, modo competitivo) --
// cola de emparejamiento y creación de la Sala competitiva resultante.
// Reparto de trofeos al CERRAR la partida vive en finalizarPartidaSiToca
// (src/lib/salas.ts), no aquí -- esto solo cubre "cómo se llega a tener
// una Sala competitiva", el resto de la partida en sí es indistinguible
// de una Sala normal (mismo motor, ver src/lib/salas.ts).

import { prisma } from "@/lib/prisma";
import { generarCodigoSalaUnico } from "@/lib/salas";
import { generarTableroDesdeBD } from "@/features/games/grid/generarTablero.server";
import { sonEmparejablesEnCola, rangoAceptableTrofeos } from "@/lib/trofeos";
import type { Dificultad } from "@/features/games/shared/types";

// Grid Ranked v1: todo el mundo juega la MISMA dificultad -- así el
// ladder compara manzanas con manzanas (un rival más flojo no tiene
// "ventaja" jugando en fácil). "medio" es un punto intermedio razonable
// para empezar; se puede revisar con datos reales de temporada 1.
export const DIFICULTAD_RANKED: Dificultad = "medio";

// El ranked tiene SU PROPIA duración de ronda, fija en 180s (3 min) --
// independiente de `duracionRondaSegundos(dificultad)` de salas.ts, que
// para "medio" da 240s. Decisión del usuario (19/08/2026): el competitivo
// tiene que sentirse más ágil que una partida casual normal, así que no
// reutilizamos la escala pensada para el modo casual.
const DURACION_RONDA_RANKED_SEGUNDOS = 180;

// Cuánto tiempo sin "dar señales de vida" (sin que su cliente haga un
// POST/GET a /api/ranked/cola) tiene que pasar para considerar una fila
// de ColaRanked abandonada y purgarla antes de emparejar a nadie contra
// ella. El cliente hace polling cada 2000ms (INTERVALO_POLLING_COLA_MS en
// el hub) -- 8s da margen de sobra para 3-4 polls perdidos por un blip de
// red o la pestaña en segundo plano, sin dejar una ventana larga en la
// que un jugador real pueda "gastar" su emparejamiento contra un fantasma.
const MS_ABANDONO_COLA = 8_000;

export type EstadoCola =
  | { estado: "esperando"; segundosEsperando: number; rangoAceptable: number }
  | { estado: "emparejado"; codigoSala: string }
  // No está (ni estaba) en cola -- nunca entró, o canceló, o el poll llegó
  // tan tarde que ni rastro queda de la Sala que se le pudo haber creado
  // (no debería pasar en la práctica, es una red de seguridad).
  | { estado: "fuera" };

/** Mete a `userId` en la cola (o actualiza su fila si ya estaba, sin
 * resetear `entradaEn` -- no queremos que un doble-click reinicie su
 * tiempo de espera). Después intenta emparejar de inmediato, por si ya
 * hay alguien esperando compatible -- así no hace falta esperar al
 * siguiente poll para el caso más habitual (dos personas entran casi a la
 * vez). */
export async function entrarEnCola(userId: string, trofeosActuales: number): Promise<EstadoCola> {
  await prisma.colaRanked.upsert({
    where: { userId },
    update: { trofeosEnCola: trofeosActuales, ultimoPing: new Date() },
    create: { userId, trofeosEnCola: trofeosActuales },
  });

  return intentarEmparejar(userId);
}

export async function salirDeCola(userId: string): Promise<void> {
  await prisma.colaRanked.deleteMany({ where: { userId } });
}

/** Borra las filas de ColaRanked que llevan demasiado tiempo sin dar
 * señales de vida (ver MS_ABANDONO_COLA) -- pestaña cerrada, conexión
 * perdida, o cualquier salida que no pasó por el DELETE explícito de
 * /api/ranked/cola. Se llama al principio de `intentarEmparejar`, antes
 * de mirar candidatos, para que nadie pueda emparejarse contra un
 * fantasma: eso dejaría a su rival de verdad esperando solo, sin nadie
 * con quien emparejarlo, y es exactamente el bug reportado el
 * 07/09/2026 (dos amigos buscando partida a la vez -- uno entró, el otro
 * se quedó "buscando" indefinidamente). */
async function purgarColaAbandonada(): Promise<void> {
  await prisma.colaRanked.deleteMany({
    where: { ultimoPing: { lt: new Date(Date.now() - MS_ABANDONO_COLA) } },
  });
}

/** Comprueba si `userId` sigue en cola y, si es así, intenta emparejarlo
 * con algún candidato compatible ahora mismo. Se llama tanto al entrar en
 * cola como en cada poll (GET /api/ranked/cola) -- es la única puerta de
 * entrada a la creación de una Sala competitiva. */
export async function intentarEmparejar(userId: string): Promise<EstadoCola> {
  await purgarColaAbandonada();

  const propio = await prisma.colaRanked.findUnique({ where: { userId } });
  if (!propio) {
    // Ya no está en cola -- o bien se le acaba de emparejar (comprobamos
    // si tiene una Sala competitiva EN_CURSO recién creada) o canceló.
    const salaReciente = await salaCompetitivaEnCursoDe(userId);
    if (salaReciente) return { estado: "emparejado", codigoSala: salaReciente };
    return { estado: "fuera" };
  }

  // Cada llamada (entrada inicial o poll) es una prueba de vida real --
  // la refrescamos ya, antes de intentar nada más, para que esta misma
  // fila no pueda ser purgada por error mientras el jugador sigue aquí.
  await prisma.colaRanked.update({ where: { userId }, data: { ultimoPing: new Date() } });

  const segundosPropios = (Date.now() - propio.entradaEn.getTime()) / 1000;

  const candidatos = await prisma.colaRanked.findMany({
    where: { userId: { not: userId } },
    orderBy: { entradaEn: "asc" }, // prioriza a quien más tiempo lleva esperando
  });

  for (const candidato of candidatos) {
    const segundosCandidato = (Date.now() - candidato.entradaEn.getTime()) / 1000;
    const compatibles = sonEmparejablesEnCola(
      { trofeos: propio.trofeosEnCola, segundosEsperando: segundosPropios },
      { trofeos: candidato.trofeosEnCola, segundosEsperando: segundosCandidato }
    );
    if (!compatibles) continue;

    const codigoSala = await intentarCrearSalaCompetitiva(propio, candidato);
    if (codigoSala) return { estado: "emparejado", codigoSala };
    // Si `intentarCrearSalaCompetitiva` devuelve null es porque alguno de
    // los dos ya se emparejó con otra persona justo antes (carrera entre
    // dos polls casi simultáneos) -- seguimos probando con el siguiente
    // candidato en vez de rendirnos.
  }

  // Antes de decir "esperando": puede que justo en este intento hayamos
  // perdido nosotros mismos una carrera de emparejamiento (otro poll,
  // nuestro o de un candidato, nos emparejó con alguien mientras
  // recorríamos la lista de arriba) -- sin esta comprobación, esta misma
  // respuesta sería una mentira momentánea ("esperando" cuando en
  // realidad ya hay Sala) que solo se corregía en el SIGUIENTE poll, 2s
  // más tarde. Nos volvemos a asegurar de que seguimos en cola de verdad.
  const seguimosEnCola = await prisma.colaRanked.findUnique({ where: { userId }, select: { id: true } });
  if (!seguimosEnCola) {
    const salaReciente = await salaCompetitivaEnCursoDe(userId);
    if (salaReciente) return { estado: "emparejado", codigoSala: salaReciente };
    return { estado: "fuera" };
  }

  return {
    estado: "esperando",
    segundosEsperando: Math.round(segundosPropios),
    rangoAceptable: rangoAceptableTrofeos(segundosPropios),
  };
}

type FilaColaRanked = { userId: string; trofeosEnCola: number };

/** Intenta cerrar el emparejamiento entre estos dos exactamente: borra
 * ambas filas de la cola de forma atómica y, SOLO si de verdad se
 * borraron las dos (ninguna la había tocado ya otra petición concurrente),
 * crea la Sala competitiva. Devuelve el código de Sala si se creó, o
 * `null` si la carrera se perdió (alguno de los dos ya no estaba en
 * cola). */
async function intentarCrearSalaCompetitiva(a: FilaColaRanked, b: FilaColaRanked): Promise<string | null> {
  const contenido = await generarTableroDesdeBD(DIFICULTAD_RANKED);
  const codigo = await generarCodigoSalaUnico();

  try {
    await prisma.$transaction(async (tx) => {
      const borrados = await tx.colaRanked.deleteMany({
        where: { userId: { in: [a.userId, b.userId] } },
      });
      if (borrados.count !== 2) {
        // Alguno de los dos ya no estaba en cola -- abortar creando un
        // error a propósito para que $transaction haga rollback de este
        // deleteMany parcial (si borró uno de los dos) y no se cree la Sala.
        throw new Error("CARRERA_PERDIDA");
      }

      const ahora = new Date();
      await tx.sala.create({
        data: {
          codigo,
          creadorId: a.userId, // no tiene efecto real en una Sala competitiva -- el schema exige un creador
          juego: "GRID",
          dificultad: DIFICULTAD_RANKED,
          maxJugadores: 2,
          competitiva: true,
          contenido,
          duracionSegundos: DURACION_RONDA_RANKED_SEGUNDOS,
          // A diferencia de una Sala casual (que arranca en ESPERANDO y
          // exige que el creador pulse "Empezar"), una Sala ranked empieza
          // YA en marcha -- el emparejamiento automático ES el "empezar".
          estado: "EN_CURSO",
          enCursoDesde: ahora,
          jugadores: {
            create: [
              { userId: a.userId, listo: true, trofeosAlEmpezar: a.trofeosEnCola },
              { userId: b.userId, listo: true, trofeosAlEmpezar: b.trofeosEnCola },
            ],
          },
        },
      });
    });
  } catch (err) {
    if (err instanceof Error && err.message === "CARRERA_PERDIDA") return null;
    throw err;
  }

  return codigo;
}

/** Si `userId` acaba de ser emparejado (ya no está en ColaRanked) pero el
 * cliente pregunta justo en ese instante, esto le devuelve el código de la
 * Sala competitiva EN_CURSO más reciente en la que participa -- para no
 * dejarlo "en el limbo" si su petición de poll llegó justo después de que
 * OTRO poll (del rival, o el suyo propio en paralelo) ya le emparejara. */
async function salaCompetitivaEnCursoDe(userId: string): Promise<string | null> {
  const sj = await prisma.salaJugador.findFirst({
    where: { userId, sala: { competitiva: true, estado: "EN_CURSO" } },
    orderBy: { unidoEn: "desc" },
    select: { sala: { select: { codigo: true } } },
  });
  return sj?.sala.codigo ?? null;
}