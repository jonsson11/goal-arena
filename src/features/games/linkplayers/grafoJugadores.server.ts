// src/features/games/linkplayers/grafoJugadores.server.ts
//
// SOLO SERVIDOR.
//
// LinkPlayers necesita responder a una pregunta muy concreta: "¿han
// jugado juntos estos dos jugadores?" -- y la respuesta ya vive en la
// base de datos, en el modelo Stint (jugador + equipo + fecha de inicio +
// fecha de fin) que ya usa el 3x3/ADN/Fichajes. Dos jugadores han jugado
// juntos si tienen algún Stint en el MISMO equipo con fechas que se
// solapan (selecciones no cuentan a propósito: Stint solo guarda clubes).
// No hace falta ninguna tabla ni migración nueva, solo mirar el mismo
// dato con una pregunta distinta.
//
// Este archivo construye ese grafo completo una vez (todos los jugadores
// como nodos, una arista entre dos jugadores que coincidieron en algún
// club) y lo cachea -- igual que construirIndice en
// src/features/games/grid/indiceEquipos.server.ts, y por el mismo motivo:
// recorrer TODOS los Stint en cada generación de partida o cada Step que
// verifica el jugador sería justo el tipo de lentitud que ya se corrigió
// ahí. 30 minutos de TTL (más que los 5 del índice del 3x3) porque aquí
// no hace falta la frescura al segundo -- los Stints cambian solo cuando
// se ejecuta un script de sync.

import { prisma } from "@/lib/prisma";
import { conCache } from "@/lib/cache";
import { esNombreValido } from "@/features/games/grid/indiceEquipos.server";
import type { ResultadoConexion, PasoCadena } from "./type";

type StintCrudo = {
  playerId: string;
  teamId: string;
  startDate: Date;
  endDate: Date | null;
  team: { nombre: string; elegibleParaGrid: boolean };
  player: { nombre: string; nacionalidad: string; imagenUrl: string | null };
};

export type NodoJugador = {
  id: string;
  nombre: string;
  nacionalidad: string;
  imagenUrl: string | null;
  // Ha jugado (en cualquier temporada) en alguno de los TOP_CLUBES_
  // CONOCIDOS -- ver más abajo. Ajustado el 11/08/2026: antes bastaba
  // cualquier equipo con elegibleParaGrid=true (un pool grande, pensado
  // para el 3x3), y el usuario reportó que seguían saliendo jugadores
  // poco conocidos como inicio/final. Ahora es un pool mucho más
  // pequeño y curado, pensado específicamente para "¿este jugador se
  // reconoce a simple vista?". Solo se usa para decidir quién puede ser
  // jugador INICIAL o FINAL de la partida -- el camino en sí puede pasar
  // por cualquier jugador del grafo, conocido o no, igual que en la vida
  // real una cadena de excompañeros puede pasar por un club pequeño de
  // por medio.
  conocido: boolean;
  // Etapas de este jugador (equipo + años), ordenadas cronológicamente --
  // fuente de las pistas que se enseñan en la tarjeta del jugador
  // inicial/final según la dificultad (ver generarPartida.server.ts).
  // Nunca se usa para nada más que eso: no entra en el cálculo del grafo
  // ni del camino más corto.
  etapas: { equipo: string; desde: string; hasta: string }[];
};

export type Conexion = { equipo: string; desde: string; hasta: string };

export type GrafoJugadores = {
  nodos: Map<string, NodoJugador>;
  adyacencia: Map<string, Map<string, Conexion>>;
  // ids de nodos "conocidos" (ver NodoJugador.conocido), ya en un array
  // plano para barajar/samplear.
  conocidos: string[];
  // Los endpoints (generar/verificar) trabajan con NOMBRES, no ids
  // internos -- mismo criterio que el resto de la app (Top10, Grid,
  // PlayerSearch identifican jugadores por nombre, no por id). Si dos
  // jugadores reales compartieran nombre exacto, gana el último que se
  // procesó al construir el grafo -- riesgo ya asumido en el resto del
  // proyecto, no específico de LinkPlayers.
  idsPorNombre: Map<string, string>;
};

function seSolapan(aInicio: Date, aFin: Date | null, bInicio: Date, bFin: Date | null): boolean {
  const finA = aFin ?? new Date(); // etapa actual = sigue vigente hoy
  const finB = bFin ?? new Date();
  return aInicio <= finB && bInicio <= finA;
}

function anio(fecha: Date): string {
  return String(fecha.getFullYear());
}

// Años del solape real entre dos Stints (no de cada Stint por separado):
// el más tardío de los dos inicios, hasta el más temprano de los dos
// finales -- "actualidad" solo si NINGUNO de los dos ha terminado.
function anosDeSolape(a: StintCrudo, b: StintCrudo): { desde: string; hasta: string } {
  const inicio = a.startDate > b.startDate ? a.startDate : b.startDate;

  if (!a.endDate && !b.endDate) return { desde: anio(inicio), hasta: "actualidad" };
  if (!a.endDate) return { desde: anio(inicio), hasta: anio(b.endDate!) };
  if (!b.endDate) return { desde: anio(inicio), hasta: anio(a.endDate) };

  const fin = a.endDate < b.endDate ? a.endDate : b.endDate;
  return { desde: anio(inicio), hasta: anio(fin) };
}

async function obtenerStints(): Promise<StintCrudo[]> {
  const stints = await prisma.stint.findMany({
    select: {
      playerId: true,
      teamId: true,
      startDate: true,
      endDate: true,
      team: { select: { nombre: true, elegibleParaGrid: true } },
      player: { select: { nombre: true, nacionalidad: true, imagenUrl: true } },
    },
  });
  return stints.filter((s) => esNombreValido(s.team.nombre));
}

// Cuántos equipos (de entre los marcados elegibleParaGrid=true, mismo
// filtro "no un club rarísimo" del 3x3) entran en el pool de "clubes
// conocidos" que decide quién puede ser jugador inicial/final. Se eligen
// los que más plantilla histórica tienen registrada -- mismo truco que
// TOP_CLUBES_GRANDES_FACIL en generarTablero.server.ts (el 3x3 solo lo
// usa para su dificultad fácil; aquí se aplica siempre, a las tres
// dificultades de LinkPlayers, porque el problema que reportó el usuario
// el 11/08/2026 -- "salen jugadores poco conocidos" -- no dependía de la
// dificultad elegida). 40 en vez de los 30 del 3x3 porque aquí hace falta
// algo más de variedad para que no toquen siempre los mismos nombres.
// Primera estimación a ojo, ajustable sin más que cambiar este número.
const TOP_CLUBES_CONOCIDOS = 40;

function formatearEtapa(s: StintCrudo): { equipo: string; desde: string; hasta: string } {
  return { equipo: s.team.nombre, desde: anio(s.startDate), hasta: s.endDate ? anio(s.endDate) : "actualidad" };
}

export async function construirGrafo(): Promise<GrafoJugadores> {
  return conCache("grafo-jugadores-linkplayers", 30 * 60 * 1000, async () => {
    const stints = await obtenerStints();

    const nodos = new Map<string, NodoJugador>();
    const idsPorNombre = new Map<string, string>();
    const stintsPorEquipo = new Map<string, StintCrudo[]>();
    const equipoElegibleParaGrid = new Map<string, boolean>();

    // Primera pasada: nodos (sin decidir todavía quién es "conocido" --
    // hace falta ver la plantilla histórica de TODOS los equipos antes de
    // poder ordenarlos), agrupación por equipo, y las etapas de cada
    // jugador (para las pistas por dificultad).
    for (const s of stints) {
      if (!nodos.has(s.playerId)) {
        nodos.set(s.playerId, {
          id: s.playerId,
          nombre: s.player.nombre,
          nacionalidad: s.player.nacionalidad,
          imagenUrl: s.player.imagenUrl,
          conocido: false,
          etapas: [],
        });
        idsPorNombre.set(s.player.nombre, s.playerId);
      }
      nodos.get(s.playerId)!.etapas.push(formatearEtapa(s));

      if (!stintsPorEquipo.has(s.teamId)) stintsPorEquipo.set(s.teamId, []);
      stintsPorEquipo.get(s.teamId)!.push(s);
      equipoElegibleParaGrid.set(s.teamId, s.team.elegibleParaGrid);
    }

    // Etapas en orden cronológico -- el orden de llegada de obtenerStints()
    // no está garantizado.
    for (const nodo of nodos.values()) {
      nodo.etapas.sort((a, b) => Number(a.desde) - Number(b.desde));
    }

    // Segunda pasada: los equipos "conocidos" son los TOP_CLUBES_CONOCIDOS
    // con más plantilla histórica distinta, de entre los ya marcados
    // elegibleParaGrid=true. Cualquier jugador con al menos un Stint (en
    // CUALQUIER temporada) en uno de esos equipos queda marcado `conocido`.
    const equiposConocidosIds = new Set(
      [...stintsPorEquipo.entries()]
        .filter(([teamId]) => equipoElegibleParaGrid.get(teamId))
        .sort((a, b) => new Set(b[1].map((s) => s.playerId)).size - new Set(a[1].map((s) => s.playerId)).size)
        .slice(0, TOP_CLUBES_CONOCIDOS)
        .map(([teamId]) => teamId)
    );

    for (const [teamId, stintsEquipo] of stintsPorEquipo) {
      if (!equiposConocidosIds.has(teamId)) continue;
      for (const s of stintsEquipo) nodos.get(s.playerId)!.conocido = true;
    }

    const adyacencia = new Map<string, Map<string, Conexion>>();

    function conectar(a: string, b: string, conexion: Conexion) {
      if (!adyacencia.has(a)) adyacencia.set(a, new Map());
      // Si dos jugadores coincidieron en más de un club a lo largo de su
      // carrera, se queda la primera conexión encontrada -- no hace falta
      // enseñar las dos, con una basta para justificar el Step.
      if (!adyacencia.get(a)!.has(b)) adyacencia.get(a)!.set(b, conexion);
    }

    // Dentro de cada equipo, comparar cada Stint contra los demás Stints
    // de ESE MISMO equipo (no contra todos los Stint del sistema) --
    // acota muchísimo el número de comparaciones frente a hacerlo contra
    // el total. Ojo: esto recorre TODOS los equipos, no solo los
    // "conocidos" -- el camino en sí puede pasar por cualquier club.
    for (const stintsEquipo of stintsPorEquipo.values()) {
      for (let i = 0; i < stintsEquipo.length; i++) {
        for (let j = i + 1; j < stintsEquipo.length; j++) {
          const a = stintsEquipo[i];
          const b = stintsEquipo[j];
          if (a.playerId === b.playerId) continue;
          if (!seSolapan(a.startDate, a.endDate, b.startDate, b.endDate)) continue;

          const { desde, hasta } = anosDeSolape(a, b);
          const conexion: Conexion = { equipo: a.team.nombre, desde, hasta };
          conectar(a.playerId, b.playerId, conexion);
          conectar(b.playerId, a.playerId, conexion);
        }
      }
    }

    const conocidos = [...nodos.values()].filter((n) => n.conocido).map((n) => n.id);

    return { nodos, adyacencia, conocidos, idsPorNombre };
  });
}

// BFS clásico: una sola pasada desde `origen` da la distancia (en Steps)
// a TODOS los demás jugadores del grafo de golpe -- así generarPartida.
// server.ts no necesita repetir un BFS por cada pareja candidata, con uno
// solo por jugador "inicio" que se prueba ya sabe la distancia a todo el
// mundo. De paso guarda el predecesor de cada nodo en su camino más corto
// desde `origen` -- es lo que permite reconstruir el camino en sí (ver
// reconstruirCamino más abajo), no solo su longitud.
export type ResultadoBfs = {
  distancias: Map<string, number>;
  predecesores: Map<string, string>;
};

export function bfsDesde(origen: string, grafo: GrafoJugadores): ResultadoBfs {
  const distancias = new Map<string, number>([[origen, 0]]);
  const predecesores = new Map<string, string>();
  const cola: string[] = [origen];
  let cabeza = 0;

  while (cabeza < cola.length) {
    const actual = cola[cabeza++];
    const distanciaActual = distancias.get(actual)!;
    const vecinos = grafo.adyacencia.get(actual);
    if (!vecinos) continue;

    for (const vecino of vecinos.keys()) {
      if (distancias.has(vecino)) continue;
      distancias.set(vecino, distanciaActual + 1);
      predecesores.set(vecino, actual);
      cola.push(vecino);
    }
  }

  return { distancias, predecesores };
}

// Reconstruye UN camino más corto real (puede haber varios de la misma
// longitud; el BFS solo se queda con el primero que encontró) entre
// `origen` y `destino`, siguiendo `predecesores` hacia atrás desde el
// destino. Se usa para poder enseñar el camino de verdad al rendirse
// (ver "Al continuar" del roadmap / petición del usuario del 11/08) --
// hasta ahora solo se enseñaba el número de Steps, no el camino en sí.
export function reconstruirCamino(destino: string, resultado: ResultadoBfs, grafo: GrafoJugadores): PasoCadena[] {
  const idsEnOrden: string[] = [destino];
  let actual = destino;

  while (resultado.predecesores.has(actual)) {
    actual = resultado.predecesores.get(actual)!;
    idsEnOrden.unshift(actual);
  }

  return idsEnOrden.map((id, i) => {
    const nodo = grafo.nodos.get(id)!;
    const jugador = { nombre: nodo.nombre, nacionalidad: nodo.nacionalidad, imagenUrl: nodo.imagenUrl };
    if (i === 0) return { jugador };

    const anteriorId = idsEnOrden[i - 1];
    const conexion = grafo.adyacencia.get(anteriorId)!.get(id)!;
    return { jugador, conexion: { equipo: conexion.equipo, temporada: `${conexion.desde} - ${conexion.hasta}` } };
  });
}

// Usado por POST /api/jugadores/enlazar/verificar en cada Step que
// intenta el jugador -- por eso trabaja con nombres (lo único que tiene
// el cliente, ver PlayerSearch/Jugador) y no con ids internos.
export async function verificarConexion(nombreActual: string, nombreSiguiente: string): Promise<ResultadoConexion> {
  const grafo = await construirGrafo();

  const idActual = grafo.idsPorNombre.get(nombreActual);
  const idSiguiente = grafo.idsPorNombre.get(nombreSiguiente);
  if (!idActual || !idSiguiente) return { conectados: false };

  const conexion = grafo.adyacencia.get(idActual)?.get(idSiguiente);
  if (!conexion) return { conectados: false };

  return { conectados: true, equipoComun: conexion.equipo, temporada: `${conexion.desde} - ${conexion.hasta}` };
}
