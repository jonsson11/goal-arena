// src/features/games/linkplayers/generarPartida.server.ts
//
// SOLO SERVIDOR.

import { construirGrafo, bfsDesde, reconstruirCamino, type GrafoJugadores, type NodoJugador } from "./grafoJugadores.server";
import type { PartidaGenerada, JugadorObjetivo, PistaEtapa } from "./type";
import type { Dificultad } from "@/features/games/shared/types";

// Steps mínimos y máximos que debe tener el camino más corto real entre
// el jugador inicial y el final, según la dificultad elegida (mismo
// selector que ya usa el 3x3, ver GameLauncher.tsx con `dificultades`).
// HISTORIAL (11/08/2026): en la 3ª ronda del día se probó hacer fácil más
// fácil acortando este rango a 1-2 Steps -- funcionaba, pero el usuario
// prefirió otro camino: en la 4ª ronda se revirtió esto a su valor
// original (2-3, igual que medio/difícil en proporción) y en su lugar se
// capó mucho más el pool de jugador inicial/final SOLO para fácil (ver
// `conocidosFacil`/TOP_CLUBES_FACIL en grafoJugadores.server.ts, 10
// clubes en vez de los 25 de medio/difícil) -- la dificultad ahora viene
// de "qué tan reconocibles son los dos jugadores", no de acortar el
// camino que hay que encontrar entre ellos.
const RANGO_STEPS_POR_DIFICULTAD: Record<Dificultad, { min: number; max: number }> = {
  facil: { min: 2, max: 3 },
  medio: { min: 4, max: 5 },
  dificil: { min: 6, max: 8 },
};

// Qué pistas de Stints se enseñan en las tarjetas del jugador inicial y
// final -- siempre las etapas completas (equipo + años). Antes variaba
// por dificultad (fácil = etapas completas, medio = solo equipos, difícil
// = ninguna); a petición del usuario (11/08/2026, 3ª ronda) las pistas se
// mantienen ahora IGUAL en los tres niveles, y lo que diferencia la
// dificultad de verdad es únicamente el rango de Steps exigido (ver
// RANGO_STEPS_POR_DIFICULTAD arriba).
function pistasDeJugador(nodo: NodoJugador): PistaEtapa[] {
  return nodo.etapas.map((e) => ({ equipo: e.equipo, temporada: `${e.desde} - ${e.hasta}`, cedido: e.cedido }));
}

// Cuántos jugadores "inicio" distintos se prueban, cada uno con SU propio
// BFS a todo el grafo, antes de rendirse. Un solo BFS ya calcula la
// distancia a TODOS los demás jugadores de golpe (ver bfsDesde), así que
// no hace falta -- a diferencia del 3x3, que sí prueba cientos de
// combinaciones sueltas -- probar miles de parejas: basta con unos pocos
// orígenes hasta que alguno tenga, entre los jugadores conocidos, algún
// candidato a la distancia buscada.
const INTENTOS_ORIGEN = 25;

function barajar<T>(items: T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function aObjetivo(grafo: GrafoJugadores, id: string): JugadorObjetivo {
  const nodo = grafo.nodos.get(id)!;
  return {
    nombre: nodo.nombre,
    nacionalidad: nodo.nacionalidad,
    imagenUrl: nodo.imagenUrl,
    pistas: pistasDeJugador(nodo),
  };
}

function buscarCandidatos(
  pool: string[],
  origen: string,
  distancias: Map<string, number>,
  minSteps: number,
  maxSteps: number
): string[] {
  return pool.filter((id) => {
    if (id === origen) return false;
    const d = distancias.get(id);
    return d !== undefined && d >= minSteps && d <= maxSteps;
  });
}

export async function generarPartida(dificultad: Dificultad = "medio"): Promise<PartidaGenerada> {
  const grafo = await construirGrafo();

  // Fácil tira de un pool mucho más pequeño (solo los 10 clubes más
  // grandes del mundo, ver TOP_CLUBES_FACIL en grafoJugadores.server.ts)
  // que medio/difícil (25 clubes) -- petición del usuario (11/08/2026, 4ª
  // ronda): "capa mucho más los jugadores solo para ese modo [fácil]".
  const pool = dificultad === "facil" ? grafo.conocidosFacil : grafo.conocidos;

  if (pool.length < 2) {
    throw new Error("Todavía no hay suficientes jugadores para generar una partida de LinkPlayers.");
  }

  const { min: minSteps, max: maxSteps } = RANGO_STEPS_POR_DIFICULTAD[dificultad];
  const origenesBarajados = barajar(pool).slice(0, INTENTOS_ORIGEN);

  // Primera pasada: exige el rango de la dificultad elegida.
  for (const origen of origenesBarajados) {
    const resultado = bfsDesde(origen, grafo);
    const candidatos = buscarCandidatos(pool, origen, resultado.distancias, minSteps, maxSteps);
    if (candidatos.length === 0) continue;

    const destino = candidatos[Math.floor(Math.random() * candidatos.length)];
    return {
      jugadorInicial: aObjetivo(grafo, origen),
      jugadorFinal: aObjetivo(grafo, destino),
      distanciaMinima: resultado.distancias.get(destino)!,
      caminoSolucion: reconstruirCamino(destino, resultado, grafo),
    };
  }

  // Fallback: si con los datos que hay todavía (grafo disperso, poca
  // historia de fichajes cargada) ningún origen tuvo candidatos dentro del
  // rango de la dificultad, se acepta cualquier distancia >= minSteps sin
  // límite superior -- mejor una partida más larga de la cuenta que
  // ninguna.
  for (const origen of origenesBarajados) {
    const resultado = bfsDesde(origen, grafo);
    const candidatos = buscarCandidatos(pool, origen, resultado.distancias, minSteps, Infinity);
    if (candidatos.length === 0) continue;

    const destino = candidatos[Math.floor(Math.random() * candidatos.length)];
    return {
      jugadorInicial: aObjetivo(grafo, origen),
      jugadorFinal: aObjetivo(grafo, destino),
      distanciaMinima: resultado.distancias.get(destino)!,
      caminoSolucion: reconstruirCamino(destino, resultado, grafo),
    };
  }

  throw new Error("No se pudo encontrar una pareja de jugadores válida. Inténtalo de nuevo.");
}
