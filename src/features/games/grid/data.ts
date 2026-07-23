import type { Equipo, Jugador, Condicion, Tablero, Celda } from "./type";

export const equipos: Equipo[] = [
  { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
  { nombre: "Real Madrid", pais: "España", escudo: "/escudos/real-madrid.png" },
  { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
  { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
];

export const jugadores: Jugador[] = [
  {
    nombre: "Joaquin",
    fechaNacimiento: "1981-07-21",
    nacionalidad: "España",
    equipos: [
      { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
      { nombre: "Valencia", pais: "España", escudo: "/escudos/valencia.png" },
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
    ],
  },
  {
    nombre: "Denilson",
    fechaNacimiento: "1988-02-16",
    nacionalidad: "Brasil",
    equipos: [
      { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
    ],
  },
  {
    nombre: "Neymar",
    fechaNacimiento: "1992-02-05",
    nacionalidad: "Brasil",
    equipos: [
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
      { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
    ],
  },
  {
    nombre: "Ter Stegen",
    fechaNacimiento: "1992-02-05",
    nacionalidad: "Alemania",
    equipos: [
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
      { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
    ],
  },
  {
    nombre: "Fabian",
    fechaNacimiento: "1992-02-05",
    nacionalidad: "España",
    equipos: [
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
      { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
      { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
    ],
  },
    {
    nombre: "Mustafi",
    fechaNacimiento: "1992-02-05",
    nacionalidad: "Alemania",
    equipos: [
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
      { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
      { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
    ],
  },
];

export const condiciones: Condicion[] = [
  { tipo: "equipo", valor: "Barcelona" },
  { tipo: "equipo", valor: "Betis" },
  { tipo: "equipo", valor: "PSG" },
  { tipo: "nacionalidad", valor: "España" },
  { tipo: "nacionalidad", valor: "Brasil" },
  { tipo: "nacionalidad", valor: "Alemania" },

];

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
