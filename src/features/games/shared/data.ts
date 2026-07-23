import type { Equipo, Jugador } from "./types";

export const equipos: Equipo[] = [
  { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
  { nombre: "Real Madrid", pais: "España", escudo: "/escudos/real-madrid.png" },
  { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
  { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
];

export const jugadores: Jugador[] = [
  {
    nombre: "Joaquín",
    fechaNacimiento: "1981-07-21",
    nacionalidad: "España",
    equipos: [
      { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
      { nombre: "Valencia", pais: "España", escudo: "/escudos/valencia.png" },
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
    ],
    valorDeMercado: 20,
    goles: 100,
    asistencias: 50,
    partidos: 600,
  },
  {
    nombre: "Denílson",
    fechaNacimiento: "1988-02-16",
    nacionalidad: "Brasil",
    equipos: [
      { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
    ],
    valorDeMercado: 2,
    goles: 10,
    asistencias: 50,
    partidos: 600,
  },
  {
    nombre: "Neymar",
    fechaNacimiento: "1992-02-05",
    nacionalidad: "Brasil",
    equipos: [
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
      { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
    ],
    valorDeMercado: 220,
    goles: 300,
    asistencias: 55,
    partidos: 700,
  },
  {
    nombre: "Fabián",
    fechaNacimiento: "1992-02-05",
    nacionalidad: "España",
    equipos: [
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
      { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
      { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
    ],
    valorDeMercado: 60,
    goles: 45,
    asistencias: 50,
    partidos: 200,
  },
  {
    nombre: "Ter Stegen",
    fechaNacimiento: "1992-02-05",
    nacionalidad: "Alemania",
    equipos: [
      { nombre: "Barcelona", pais: "España", escudo: "/escudos/barcelona.png" },
      { nombre: "PSG", pais: "Francia", escudo: "/escudos/psg.png" },
      { nombre: "Betis", pais: "España", escudo: "/escudos/betis.png" },
    ],
    valorDeMercado: 10,
    goles: 0,
    asistencias: 3,
    partidos: 444,
  },
];