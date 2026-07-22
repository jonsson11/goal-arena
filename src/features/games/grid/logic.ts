import type { Jugador, Condicion } from "./type";

export function cumpleCondicion(jugador: Jugador, condicion: Condicion): boolean {
  if (condicion.tipo === "equipo") {
    return jugador.equipos.some((equipo) => equipo.nombre === condicion.valor);
  }

  if (condicion.tipo === "nacionalidad") {
    return jugador.nacionalidad === condicion.valor;
  }

  return false;
}

export function cumpleAmbasCondiciones(
  jugador: Jugador,
  condicionFila: Condicion,
  condicionColumna: Condicion
): boolean {
  return (
    cumpleCondicion(jugador, condicionFila) &&
    cumpleCondicion(jugador, condicionColumna)
  );
}