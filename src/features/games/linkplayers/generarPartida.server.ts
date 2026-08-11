// src/features/games/linkplayers/generarPartida.server.ts
//
// SOLO SERVIDOR.

import { construirGrafo, bfsDesde, reconstruirCamino, type GrafoJugadores, type NodoJugador } from "./grafoJugadores.server";
import type { PartidaGenerada, JugadorObjetivo, PistaEtapa } from "./type";
import type { Dificultad } from "@/features/games/shared/types";

// Steps mínimos y máximos que debe tener el camino más corto real entre
// el jugador inicial y el final, según la dificultad elegida (mismo
// selector que ya usa el 3x3, ver GameLauncher.tsx con `dificultades`):
// - "facil" da parejas casi vecinas (2-3 Steps), fáciles de encontrar a
//   ojo;
// - "medio" es el punto en el que se quedaba antes de tener dificultades
//   (4-5 Steps);
// - "dificil" exige caminos más largos (6-8 Steps), donde hace falta
//   pensar varios saltos por delante.
// Primera vuelta de tuerca, igual que el resto de constantes de
// dificultad del proyecto (ver MIN_SOLUCIONES_POR_DIFICULTAD en
// generarTablero.server.ts) -- se ajusta aquí si con partidas reales se
// nota muy fácil o demasiado largo algún tramo.
const RANGO_STEPS_POR_DIFICULTAD: Record<Dificultad, { min: number; max: number }> = {
  facil: { min: 2, max: 3 },
  medio: { min: 4, max: 5 },
  dificil: { min: 6, max: 8 },
};

// Qué pistas de Stints se enseñan en las tarjetas del jugador inicial y
// final, según la dificultad -- petición del usuario (11/08/2026): en
// fácil se enseñan como ayuda para poder tirar del hilo; en difícil no
// hay ninguna, hay que reconocerlos a ojo. Los datos vienen SIEMPRE de
// `NodoJugador.etapas` (el historial real de Stints de ese jugador), solo
// cambia cuánto se recorta antes de mandarlo al cliente.
function pistasParaDificultad(nodo: NodoJugador, dificultad: Dificultad): PistaEtapa[] | undefined {
  if (dificultad === "dificil") return undefined;

  if (dificultad === "facil") {
    return nodo.etapas.map((e) => ({ equipo: e.equipo, temporada: `${e.desde} - ${e.hasta}` }));
  }

  // "medio": solo los equipos, sin años, y sin repetir (un jugador puede
  // tener dos etapas distintas en el mismo club, ej. una cesión y luego
  // una vuelta -- para esta pista solo interesa "en qué equipos ha
  // jugado", no cuántas veces).
  const equiposVistos = new Set<string>();
  const pistas: PistaEtapa[] = [];
  for (const etapa of nodo.etapas) {
    if (equiposVistos.has(etapa.equipo)) continue;
    equiposVistos.add(etapa.equipo);
    pistas.push({ equipo: etapa.equipo });
  }
  return pistas;
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

function aObjetivo(grafo: GrafoJugadores, id: string, dificultad: Dificultad): JugadorObjetivo {
  const nodo = grafo.nodos.get(id)!;
  return {
    nombre: nodo.nombre,
    nacionalidad: nodo.nacionalidad,
    imagenUrl: nodo.imagenUrl,
    pistas: pistasParaDificultad(nodo, dificultad),
  };
}

function buscarCandidatos(
  grafo: GrafoJugadores,
  origen: string,
  distancias: Map<string, number>,
  minSteps: number,
  maxSteps: number
): string[] {
  return grafo.conocidos.filter((id) => {
    if (id === origen) return false;
    const d = distancias.get(id);
    return d !== undefined && d >= minSteps && d <= maxSteps;
  });
}

export async function generarPartida(dificultad: Dificultad = "medio"): Promise<PartidaGenerada> {
  const grafo = await construirGrafo();

  if (grafo.conocidos.length < 2) {
    throw new Error("Todavía no hay suficientes jugadores para generar una partida de LinkPlayers.");
  }

  const { min: minSteps, max: maxSteps } = RANGO_STEPS_POR_DIFICULTAD[dificultad];
  const origenesBarajados = barajar(grafo.conocidos).slice(0, INTENTOS_ORIGEN);

  // Primera pasada: exige el rango de la dificultad elegida.
  for (const origen of origenesBarajados) {
    const resultado = bfsDesde(origen, grafo);
    const candidatos = buscarCandidatos(grafo, origen, resultado.distancias, minSteps, maxSteps);
    if (candidatos.length === 0) continue;

    const destino = candidatos[Math.floor(Math.random() * candidatos.length)];
    return {
      jugadorInicial: aObjetivo(grafo, origen, dificultad),
      jugadorFinal: aObjetivo(grafo, destino, dificultad),
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
    const candidatos = buscarCandidatos(grafo, origen, resultado.distancias, minSteps, Infinity);
    if (candidatos.length === 0) continue;

    const destino = candidatos[Math.floor(Math.random() * candidatos.length)];
    return {
      jugadorInicial: aObjetivo(grafo, origen, dificultad),
      jugadorFinal: aObjetivo(grafo, destino, dificultad),
      distanciaMinima: resultado.distancias.get(destino)!,
      caminoSolucion: reconstruirCamino(destino, resultado, grafo),
    };
  }

  throw new Error("No se pudo encontrar una pareja de jugadores válida. Inténtalo de nuevo.");
}
