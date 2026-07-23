import type { Jugador } from "@/features/games/shared/types";
import { jugadores } from "@/features/games/shared/data";
import { CATEGORIAS, type Categoria } from "./type";

export function elegirCategoriaAleatoria(): Categoria {
  const indice = Math.floor(Math.random() * CATEGORIAS.length);
  return CATEGORIAS[indice];
}

export function elegirJugadorAleatorio(excluir?: Jugador): Jugador {
  const disponibles = excluir
    ? jugadores.filter((j) => j.nombre !== excluir.nombre)
    : jugadores;

  const indice = Math.floor(Math.random() * disponibles.length);
  return disponibles[indice];
}

export function obtenerGanador(
  jugadorA: Jugador,
  jugadorB: Jugador,
  categoria: Categoria
): Jugador {
  if (jugadorA[categoria] >= jugadorB[categoria]) {
    return jugadorA;
  } else {
    return jugadorB;
  }
}

export function comprobarRespuesta(
  actual: Jugador,
  siguiente: Jugador,
  categoria: Categoria,
  respuesta: "mayor" | "menor"
): boolean {
  const valorActual = actual[categoria];
  const valorSiguiente = siguiente[categoria];

  if (valorSiguiente === valorActual) {
    return true; // empate cuenta siempre como acierto
  }

  const esMayor = valorSiguiente > valorActual;
  return respuesta === "mayor" ? esMayor : !esMayor;
}