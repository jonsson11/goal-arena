// src/features/games/grid/generarTablero.server.ts
//
// SOLO SERVIDOR. No importar desde componentes "use client".

import type { Condicion, Tablero, Celda } from "./type";
import { construirIndice, interseccionNoVacia, type Indice } from "./indiceEquipos.server";

const LADO = 3;
const INTENTOS_CON_DIVERSIDAD = 60;
const INTENTOS_FALLBACK = 20;

const MIN_JUGADORES_EQUIPO_FILA = 5;
const MIN_JUGADORES_NACIONALIDAD = 3;

function barajar<T>(items: T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

type Candidata = { tipo: "equipo"; valor: string } | { tipo: "nacionalidad"; valor: string };

function esValidaContraFila(candidata: Candidata, equipoFila: string, indice: Indice): boolean {
  if (candidata.tipo === "equipo") {
    const jugadoresFila = indice.jugadoresPorEquipo.get(equipoFila);
    const jugadoresColumna = indice.jugadoresPorEquipo.get(candidata.valor);
    if (!jugadoresFila || !jugadoresColumna) return false;
    return interseccionNoVacia(jugadoresFila, jugadoresColumna);
  }
  return indice.nacionalidadesPorEquipo.get(equipoFila)?.has(candidata.valor) ?? false;
}

// Reparte las 3 filas entre países distintos siempre que sea posible, en
// vez de coger los 3 primeros de una lista barajada. Con una lista plana,
// si el 70% de los clubes candidatos son italianos, el shuffle va a sacar
// mayoría italiana el 70% de las veces — no es aleatoriedad rota, es
// aleatoriedad uniforme sobre una bolsa desequilibrada. Esto arregla eso
// forzando "1 país -> 1 club" en la primera pasada.
function elegirFilasDiversificadas(clubesCandidatosFila: string[], indice: Indice): string[] {
  const clubesPorPais = new Map<string, string[]>();
  for (const club of clubesCandidatosFila) {
    const pais = indice.paisPorEquipo.get(club) ?? "Desconocido";
    if (!clubesPorPais.has(pais)) clubesPorPais.set(pais, []);
    clubesPorPais.get(pais)!.push(club);
  }

  const paisesBarajados = barajar([...clubesPorPais.keys()]);
  const filas: string[] = [];

  // 1ª pasada: un club por país distinto.
  for (const pais of paisesBarajados) {
    if (filas.length === LADO) break;
    const clubesDelPais = barajar(clubesPorPais.get(pais)!);
    filas.push(clubesDelPais[0]);
  }

  // 2ª pasada (solo entra si hay menos de 3 países con clubes candidatos):
  // rellena con clubes que aún no se hayan elegido, aunque repitan país.
  if (filas.length < LADO) {
    const restantes = barajar(clubesCandidatosFila.filter((c) => !filas.includes(c)));
    for (const club of restantes) {
      if (filas.length === LADO) break;
      filas.push(club);
    }
  }

  return filas;
}

function columnasValidasPara(filas: string[], poolColumnas: Candidata[], indice: Indice): Candidata[] {
  return barajar(poolColumnas).filter((candidata) => {
    if (candidata.tipo === "equipo" && filas.includes(candidata.valor)) return false;
    return filas.every((equipoFila) => esValidaContraFila(candidata, equipoFila, indice));
  });
}

function generarCombinacion(indice: Indice): { filas: string[]; columnas: Candidata[] } | null {
  const clubesCandidatosFila = [...indice.jugadoresPorEquipo.entries()]
    .filter(([, jugadores]) => jugadores.size >= MIN_JUGADORES_EQUIPO_FILA)
    .map(([equipo]) => equipo);

  if (clubesCandidatosFila.length < LADO) return null;

  const nacionalidadesCandidatas = [...indice.totalPorNacionalidad.entries()]
    .filter(([, total]) => total >= MIN_JUGADORES_NACIONALIDAD)
    .map(([nacionalidad]) => nacionalidad);

  const poolColumnas: Candidata[] = [
    ...[...indice.jugadoresPorEquipo.keys()].map((valor) => ({ tipo: "equipo", valor }) as Candidata),
    ...nacionalidadesCandidatas.map((valor) => ({ tipo: "nacionalidad", valor }) as Candidata),
  ];

  // Fase 1: filas forzadas a países distintos.
  for (let i = 0; i < INTENTOS_CON_DIVERSIDAD; i++) {
    const filas = elegirFilasDiversificadas(clubesCandidatosFila, indice);
    const columnas = columnasValidasPara(filas, poolColumnas, indice);
    if (columnas.length >= LADO) return { filas, columnas: columnas.slice(0, LADO) };
  }

  // Fase 2 (fallback): si las filas diversificadas nunca encuentran
  // suficientes columnas válidas —típicamente porque solo tienes 1-2
  // países bien sincronizados todavía—, se prueba sin forzar países
  // distintos antes de rendirse del todo.
  for (let i = 0; i < INTENTOS_FALLBACK; i++) {
    const filas = barajar(clubesCandidatosFila).slice(0, LADO);
    const columnas = columnasValidasPara(filas, poolColumnas, indice);
    if (columnas.length >= LADO) return { filas, columnas: columnas.slice(0, LADO) };
  }

  return null;
}

function celdasVacias(): Celda[] {
  const celdas: Celda[] = [];
  for (let fila = 0; fila < 3; fila++) {
    for (let columna = 0; columna < 3; columna++) {
      celdas.push({ fila, columna, jugador: null });
    }
  }
  return celdas;
}

export async function generarTableroDesdeBD(): Promise<Tablero> {
  const indice = await construirIndice();
  const combinacion = generarCombinacion(indice);

  if (!combinacion) {
    throw new Error(
      "No se ha podido generar un tablero solucionable con los datos actuales. Sincroniza más jugadores/equipos e inténtalo de nuevo."
    );
  }

  const condicionesFila = combinacion.filas.map((valor) => ({ tipo: "equipo", valor }) as Condicion) as [
    Condicion,
    Condicion,
    Condicion,
  ];
  const condicionesColumna = combinacion.columnas.map((c) => ({ tipo: c.tipo, valor: c.valor }) as Condicion) as [
    Condicion,
    Condicion,
    Condicion,
  ];

  return { condicionesFila, condicionesColumna, celdas: celdasVacias() };
}