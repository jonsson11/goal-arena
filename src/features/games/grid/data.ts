import type { Condicion, Celda, Tablero } from "./type";

const condicionesFila: [Condicion, Condicion, Condicion] = [
  { tipo: "equipo", valor: "Barcelona" },
  { tipo: "equipo", valor: "Betis" },
  { tipo: "equipo", valor: "PSG" },
];

const condicionesColumna: [Condicion, Condicion, Condicion] = [
  { tipo: "nacionalidad", valor: "España" },
  { tipo: "nacionalidad", valor: "Brasil" },
  { tipo: "nacionalidad", valor: "Alemania" },
];

function crearCeldasVacias(): Celda[] {
  const celdas: Celda[] = [];

  for (let fila = 0; fila < 3; fila++) {
    for (let columna = 0; columna < 3; columna++) {
      celdas.push({ fila, columna, jugador: null });
    }
  }

  return celdas;
}

export function generarTableroVacio(): Tablero {
  return {
    condicionesFila,
    condicionesColumna,
    celdas: crearCeldasVacias(),
  };
}

export const tableroEjemplo: Tablero = generarTableroVacio();