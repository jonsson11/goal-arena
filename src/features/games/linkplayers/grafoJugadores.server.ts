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
  // Ha jugado una etapa real (ver MIN_DIAS_ETAPA_CONOCIDO) en alguno de
  // los TOP_CLUBES_CONOCIDOS -- ver más abajo. Ajustado el 11/08/2026:
  // antes bastaba cualquier equipo con elegibleParaGrid=true (un pool
  // grande, pensado para el 3x3), y el usuario reportó que seguían
  // saliendo jugadores poco conocidos como inicio/final. Ahora es un pool
  // mucho más pequeño y curado, pensado específicamente para "¿este
  // jugador se reconoce a simple vista?". Solo se usa para decidir quién
  // puede ser jugador INICIAL o FINAL de la partida en dificultad medio y
  // difícil -- el camino en sí puede pasar por cualquier jugador del
  // grafo, conocido o no, igual que en la vida real una cadena de
  // excompañeros puede pasar por un club pequeño de por medio.
  conocido: boolean;
  // Igual que `conocido`, pero con un pool todavía más pequeño
  // (TOP_CLUBES_FACIL, los 10 clubes más grandes) -- añadido el
  // 11/08/2026 (4ª ronda) a petición del usuario: en vez de acortar el
  // camino para hacer fácil más sencillo (eso ya se probó y se revirtió),
  // fácil vuelve a exigir el mismo camino que antes (2-3 Steps) pero
  // eligiendo el inicial/final solo entre los clubes más reconocibles del
  // mundo, no los 25 de `conocido`. Todo jugador `conocidoFacil` es
  // también `conocido` (el pool de 10 es subconjunto del de 25).
  conocidoFacil: boolean;
  // Etapas de este jugador (equipo + años), ordenadas cronológicamente --
  // fuente de las pistas que se enseñan en la tarjeta del jugador
  // inicial/final según la dificultad (ver generarPartida.server.ts).
  // Nunca se usa para nada más que eso: no entra en el cálculo del grafo
  // ni del camino más corto. `cedido` (11/08/2026, 5ª ronda) marca las
  // etapas que probablemente fueron una cesión -- ver marcarCesiones.
  etapas: { equipo: string; desde: string; hasta: string; cedido: boolean }[];
};

export type Conexion = { equipo: string; desde: string; hasta: string };

export type GrafoJugadores = {
  nodos: Map<string, NodoJugador>;
  adyacencia: Map<string, Map<string, Conexion>>;
  // ids de nodos "conocidos" (ver NodoJugador.conocido), ya en un array
  // plano para barajar/samplear.
  conocidos: string[];
  // ids de nodos "conocidos para fácil" (ver NodoJugador.conocidoFacil) --
  // mismo array plano, pero del pool más estrecho (top 10 clubes).
  conocidosFacil: string[];
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
function anosDeSolape(
  a: { startDate: Date; endDate: Date | null },
  b: { startDate: Date; endDate: Date | null }
): { desde: string; hasta: string } {
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
// TOP_CLUBES_GRANDES_FACIL en generarTablero.server.ts. Bajado de 40 a 25
// el 11/08/2026 (2ª ronda): con 40, entraban en el pool bastantes equipos
// que ya no son de primer nivel (grandes históricos de segunda fila,
// selecciones amplias por historial), y eso dejaba pasar demasiados
// nombres poco reconocibles. Con menos clubes, el pool se concentra en
// los clubes de verdad más grandes -- si sigue viéndose flojo, este es el
// primer número a tocar (bajarlo más estrecha aún el pool).
const TOP_CLUBES_CONOCIDOS = 25;

// Pool todavía más estrecho, solo para dificultad fácil -- añadido el
// 11/08/2026 (4ª ronda) a petición del usuario: "capa mucho más los
// jugadores solo para ese modo [fácil]. Pilla de los top10 equipos del
// mundo y ya está". Mismo criterio de orden que TOP_CLUBES_CONOCIDOS
// (plantilla histórica), solo que quedándose con los 10 primeros en vez
// de 25 -- de ahí que sea un subconjunto exacto de `conocido`.
const TOP_CLUBES_FACIL = 10;

// Además de jugar en un club "conocido", ahora hace falta haberlo hecho
// una temporada real, no solo un cameo -- añadido el 11/08/2026 (2ª
// ronda) porque el filtro de solo clubes (ver arriba) seguía dejando
// pasar jugadores muy anónimos que técnicamente tuvieron un Stint muy
// breve en un club grande (una cesión de unos meses, un fichaje de enero
// que apenas jugó, un canterano que se fue casi enseguida) sin que eso
// los hiciera reconocibles de verdad. Medio año (≈180 días) es a ojo:
// deja pasar fichajes de invierno que se quedaron media temporada, pero
// no cameos de semanas.
const MIN_DIAS_ETAPA_CONOCIDO = 180;

function duracionEnDias(s: StintCrudo): number {
  const fin = s.endDate ?? new Date();
  return (fin.getTime() - s.startDate.getTime()) / (1000 * 60 * 60 * 24);
}

type EtapaCruda = { equipo: string; startDate: Date; endDate: Date | null; cedido: boolean };

// Marca qué etapas son probablemente una cesión -- añadido el 11/08/2026
// (5ª ronda) a petición del usuario: al ver una tarjeta donde un club
// seguía "actualidad" (sin fecha de fin) y DESPUÉS aparecía otro club ya
// cerrado, preguntó qué significaba, y la respuesta es que normalmente es
// una cesión (el jugador sigue de contrato en el primer club mientras
// juega cedido en el segundo). En vez de fiarnos del texto "(loan)" del
// wikitext de Wikipedia (que hoy se descarta al parsear, ver parseClub en
// wikipediaSync.ts, y no todas las fuentes lo marcan igual), se infiere
// directamente de las fechas -- más robusto y no depende de que la fuente
// lo anote bien: una etapa X es "cedido" si se solapa en el tiempo con
// OTRA etapa Y (de otro club) que empezó ANTES que X -- Y es entonces el
// club "dueño" del jugador durante ese solape, y X es la cesión.
// Recibe `etapas` YA ordenadas por `startDate` ascendente; muta en sitio.
function marcarCesiones(etapas: EtapaCruda[]): void {
  for (const etapa of etapas) {
    etapa.cedido = etapas.some(
      (otra) =>
        otra !== etapa &&
        otra.startDate.getTime() < etapa.startDate.getTime() &&
        seSolapan(etapa.startDate, etapa.endDate, otra.startDate, otra.endDate)
    );
  }
}

// Junta etapas CONSECUTIVAS en el mismo club en una sola -- ej. "Torino
// (2018-2019)" seguido de "Torino (2019-2022)" pasa a ser un único
// "Torino (2018-2022)" (petición del usuario, 11/08/2026: antes salían
// como dos etapas sueltas, aunque fuera literalmente la misma etapa
// partida en dos filas de Stint). "Consecutivas" es la palabra clave: si
// el jugador volvió a ese club más tarde tras pasar por otro equipo
// (etapas separadas, no adyacentes en la lista ya ordenada
// cronológicamente), se mantienen como etapas distintas -- eso sí es una
// segunda etapa real, no un artefacto de cómo están partidos los datos.
// Recibe `etapas` YA ordenadas por `startDate` ascendente (y ya con
// `cedido` calculado, ver marcarCesiones).
function fusionarEtapasConsecutivas(etapas: EtapaCruda[]): EtapaCruda[] {
  const fusionadas: EtapaCruda[] = [];

  for (const etapa of etapas) {
    const anterior = fusionadas[fusionadas.length - 1];

    if (anterior && anterior.equipo === etapa.equipo) {
      // Extiende el rango de la etapa anterior en vez de añadir una nueva
      // -- null (etapa todavía en curso) siempre "gana" como fecha de fin;
      // si la anterior ya estaba abierta (null), se queda así tal cual.
      if (anterior.endDate !== null && (etapa.endDate === null || etapa.endDate > anterior.endDate)) {
        anterior.endDate = etapa.endDate;
      }
      // Si cualquiera de los tramos fusionados se detectó como cesión,
      // la etapa combinada se enseña como cesión -- en la práctica casi
      // siempre coinciden (es la misma cesión partida en dos filas).
      anterior.cedido = anterior.cedido || etapa.cedido;
      continue;
    }

    fusionadas.push({ ...etapa });
  }

  return fusionadas;
}

function formatearEtapa(e: EtapaCruda): { equipo: string; desde: string; hasta: string; cedido: boolean } {
  return { equipo: e.equipo, desde: anio(e.startDate), hasta: e.endDate ? anio(e.endDate) : "actualidad", cedido: e.cedido };
}

export async function construirGrafo(): Promise<GrafoJugadores> {
  return conCache("grafo-jugadores-linkplayers", 30 * 60 * 1000, async () => {
    const stints = await obtenerStints();

    const nodos = new Map<string, NodoJugador>();
    const idsPorNombre = new Map<string, string>();
    const stintsPorEquipo = new Map<string, StintCrudo[]>();
    const equipoElegibleParaGrid = new Map<string, boolean>();
    const etapasCrudasPorJugador = new Map<string, EtapaCruda[]>();

    // Primera pasada: nodos (sin decidir todavía quién es "conocido" --
    // hace falta ver la plantilla histórica de TODOS los equipos antes de
    // poder ordenarlos), agrupación por equipo, y las etapas crudas de
    // cada jugador (para las pistas por dificultad, ver más abajo).
    for (const s of stints) {
      if (!nodos.has(s.playerId)) {
        nodos.set(s.playerId, {
          id: s.playerId,
          nombre: s.player.nombre,
          nacionalidad: s.player.nacionalidad,
          imagenUrl: s.player.imagenUrl,
          conocido: false,
          conocidoFacil: false,
          etapas: [],
        });
        idsPorNombre.set(s.player.nombre, s.playerId);
        etapasCrudasPorJugador.set(s.playerId, []);
      }
      etapasCrudasPorJugador
        .get(s.playerId)!
        .push({ equipo: s.team.nombre, startDate: s.startDate, endDate: s.endDate, cedido: false });

      if (!stintsPorEquipo.has(s.teamId)) stintsPorEquipo.set(s.teamId, []);
      stintsPorEquipo.get(s.teamId)!.push(s);
      equipoElegibleParaGrid.set(s.teamId, s.team.elegibleParaGrid);
    }

    // Etapas en orden cronológico real (por fecha, no por año -- dos
    // etapas del mismo año necesitan la fecha completa para ordenarse
    // bien), luego se marcan las posibles cesiones (ver marcarCesiones,
    // necesita ver TODAS las etapas del jugador ya ordenadas) y por
    // último se fusionan si son consecutivas en el mismo club (ver
    // fusionarEtapasConsecutivas) antes de formatear a texto.
    for (const [playerId, etapasCrudas] of etapasCrudasPorJugador) {
      etapasCrudas.sort((a, b) => a.startDate.getTime() - b.startDate.getTime());
      marcarCesiones(etapasCrudas);
      const fusionadas = fusionarEtapasConsecutivas(etapasCrudas);
      nodos.get(playerId)!.etapas = fusionadas.map(formatearEtapa);
    }

    // Segunda pasada: los equipos "conocidos" son los TOP_CLUBES_CONOCIDOS
    // con más plantilla histórica distinta, de entre los ya marcados
    // elegibleParaGrid=true -- y "conocidos para fácil" son solo los
    // primeros TOP_CLUBES_FACIL de esa misma lista ordenada (subconjunto
    // exacto). Un jugador queda marcado `conocido`/`conocidoFacil` si tuvo
    // AL MENOS una etapa de verdad (no un cameo, ver MIN_DIAS_ETAPA_
    // CONOCIDO) en uno de esos equipos.
    const equiposPorPlantilla = [...stintsPorEquipo.entries()]
      .filter(([teamId]) => equipoElegibleParaGrid.get(teamId))
      .sort((a, b) => new Set(b[1].map((s) => s.playerId)).size - new Set(a[1].map((s) => s.playerId)).size)
      .map(([teamId]) => teamId);

    const equiposConocidosIds = new Set(equiposPorPlantilla.slice(0, TOP_CLUBES_CONOCIDOS));
    const equiposFacilIds = new Set(equiposPorPlantilla.slice(0, TOP_CLUBES_FACIL));

    for (const [teamId, stintsEquipo] of stintsPorEquipo) {
      if (!equiposConocidosIds.has(teamId)) continue;
      const esFacil = equiposFacilIds.has(teamId);
      for (const s of stintsEquipo) {
        if (duracionEnDias(s) < MIN_DIAS_ETAPA_CONOCIDO) continue;
        nodos.get(s.playerId)!.conocido = true;
        if (esFacil) nodos.get(s.playerId)!.conocidoFacil = true;
      }
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
    const conocidosFacil = [...nodos.values()].filter((n) => n.conocidoFacil).map((n) => n.id);

    return { nodos, adyacencia, conocidos, conocidosFacil, idsPorNombre };
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
  const jugadores = await prisma.player.findMany({
    where: { nombre: { in: [nombreActual, nombreSiguiente] } },
    select: {
      nombre: true,
      stints: {
        select: {
          teamId: true,
          startDate: true,
          endDate: true,
          team: { select: { nombre: true } },
        },
        orderBy: { startDate: "asc" },
      },
    },
  });

  const actual = jugadores.find((j) => j.nombre === nombreActual);
  const siguiente = jugadores.find((j) => j.nombre === nombreSiguiente);
  if (!actual || !siguiente) return { conectados: false };

  // Mismo criterio que conectar() en construirGrafo: si coincidieron en
  // más de un club, basta con enseñar el primero que se encuentre.
  for (const sa of actual.stints) {
    for (const sb of siguiente.stints) {
      if (sa.teamId !== sb.teamId) continue;
      if (!seSolapan(sa.startDate, sa.endDate, sb.startDate, sb.endDate)) continue;

      const { desde, hasta } = anosDeSolape(sa, sb);
      return { conectados: true, equipoComun: sa.team.nombre, temporada: `${desde} - ${hasta}` };
    }
  }

  return { conectados: false };
}
