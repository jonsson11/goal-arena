import type { Jugador, Condicion, Tablero, Celda } from "./type";

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

export function celdasValidasParaJugador(jugador: Jugador, tablero: Tablero): Celda[] {
  return tablero.celdas.filter((celda) => {
    if (celda.jugador !== null) return false;

    const condicionFila = tablero.condicionesFila[celda.fila];
    const condicionColumna = tablero.condicionesColumna[celda.columna];

    return cumpleAmbasCondiciones(jugador, condicionFila, condicionColumna);
  });
}