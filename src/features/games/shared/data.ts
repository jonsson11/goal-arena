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
  },
  {
    nombre: "Denílson",
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
];