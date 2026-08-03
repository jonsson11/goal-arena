// src/features/games/grid/generarTablero.server.ts
//
// SOLO SERVIDOR. No importar desde componentes "use client".

import type { Condicion, Tablero, Celda } from "./type";
import type { Dificultad } from "@/features/games/shared/types";
import { construirIndice, contarSolucionesCelda, type Indice } from "./indiceEquipos.server";

const LADO = 3;

const MIN_JUGADORES_EQUIPO_FILA = 5;
const MIN_JUGADORES_NACIONALIDAD = 3;

// Cuántos clubes "grandes" (los de más plantilla histórica registrada)
// entran en el pool de fácil, tanto para filas como para columnas de tipo
// equipo. Un club con mucha plantilla acumulada tiene, casi por
// definición, mucho más solape de jugadores con otros clubes grandes y con
// las nacionalidades más comunes -- así que restringir el pool a estos
// hace que el umbral de MIN_SOLUCIONES_POR_DIFICULTAD.facil se cumpla de
// forma natural, en vez de depender de acertar un número muy alto que siga
// funcionando con cualquier club, grande o pequeño, del catálogo entero.
const TOP_CLUBES_GRANDES_FACIL = 30;

// Mínimo de jugadores válidos (soluciones posibles) que debe tener CADA una
// de las 9 casillas del tablero, para cada dificultad. "dificil" mantiene
// el comportamiento original: solo se exige que exista al menos una
// solución por casilla.
//
// HISTORIAL (para no repetir el mismo error):
// 1) facil=10 exigiendo además 2 columnas de país obligatorias -- colapsaba
//    las combinaciones a un puñado fijo (Brasil + los mismos 3-4 clubes
//    "galácticos"). Se quitó la exigencia de país por completo.
// 2) facil=8 sin exigencia de país, pero probando entre TODOS los clubes
//    elegibles (igual que medio) -- seguía fallando "bastante frecuente"
//    con los datos reales: exigir 8+ jugadores en común en las 9 casillas
//    a la vez es una condición dura de cumplir cuando el pool incluye
//    también clubes pequeños con pocos años de historial.
// Solución actual: en vez de seguir subiendo el umbral a ciegas, fácil
// restringe el pool de clubes candidatos (ver MIN_JUGADORES_EQUIPO_FILA
// más abajo) a los que tienen más plantilla histórica registrada -- esos
// clubes tienen mucho más solape de jugadores entre sí casi por
// definición, así que el umbral se cumple solo, sin depender de acertar
// un número exacto.
const MIN_SOLUCIONES_POR_DIFICULTAD: Record<Dificultad, number> = {
  facil: 6,
  medio: 5,
  dificil: 1,
};

// Cuántas combinaciones de filas se prueban antes de rendirse. No es una
// búsqueda exhaustiva de todas las combinaciones posibles, sino un sorteo
// aleatorio repetido -- así que si un nivel exige más (más soluciones por
// casilla), lo que hace falta no es bajar la exigencia, sino intentarlo más
// veces hasta dar con una combinación que la cumpla. Con ~2000 jugadores
// estos números tardan bien por debajo de un segundo; si la base de datos
// crece mucho y algún nivel empieza a notarse lento, este es el sitio para
// revisar el equilibrio intentos/tiempo.
const INTENTOS_CON_DIVERSIDAD: Record<Dificultad, number> = {
  facil: 400,
  medio: 150,
  dificil: 60,
};

const INTENTOS_FALLBACK: Record<Dificultad, number> = {
  facil: 250,
  medio: 100,
  dificil: 20,
};

function barajar<T>(items: T[]): T[] {
  const copia = [...items];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

type Candidata = { tipo: "equipo"; valor: string } | { tipo: "nacionalidad"; valor: string };

function condicionDeCandidata(candidata: Candidata): Condicion {
  return { tipo: candidata.tipo, valor: candidata.valor };
}

// Reutiliza el mismo conteo de soluciones que ya usa el endpoint de debug
// (contar-soluciones), así hay una única fuente de verdad para "cuántas
// respuestas posibles tiene esta casilla". minSoluciones=1 equivale
// exactamente al comportamiento anterior (solo exigir que exista alguna).
function celdaCumpleMinimo(
  equipoFila: string,
  candidata: Candidata,
  minSoluciones: number,
  indice: Indice
): boolean {
  const condicionFila: Condicion = { tipo: "equipo", valor: equipoFila };
  return contarSolucionesCelda(condicionFila, condicionDeCandidata(candidata), indice) >= minSoluciones;
}

function elegirFilasDiversificadas(clubesCandidatosFila: string[], indice: Indice): string[] {
  const clubesPorPais = new Map<string, string[]>();
  for (const club of clubesCandidatosFila) {
    const pais = indice.paisPorEquipo.get(club) ?? "Desconocido";
    if (!clubesPorPais.has(pais)) clubesPorPais.set(pais, []);
    clubesPorPais.get(pais)!.push(club);
  }

  const paisesBarajados = barajar([...clubesPorPais.keys()]);
  const filas: string[] = [];

  for (const pais of paisesBarajados) {
    if (filas.length === LADO) break;
    const clubesDelPais = barajar(clubesPorPais.get(pais)!);
    filas.push(clubesDelPais[0]);
  }

  if (filas.length < LADO) {
    const restantes = barajar(clubesCandidatosFila.filter((c) => !filas.includes(c)));
    for (const club of restantes) {
      if (filas.length === LADO) break;
      filas.push(club);
    }
  }

  return filas;
}

function columnasValidasPara(
  filas: string[],
  poolColumnas: Candidata[],
  minSoluciones: number,
  indice: Indice
): Candidata[] {
  return barajar(poolColumnas).filter((candidata) => {
    if (candidata.tipo === "equipo" && filas.includes(candidata.valor)) return false;
    return filas.every((equipoFila) => celdaCumpleMinimo(equipoFila, candidata, minSoluciones, indice));
  });
}

// Solo los equipos marcados como elegibles (elegibleParaGrid = true en la
// BD) pueden entrar en el pool de filas/columnas de tipo "equipo". Las
// nacionalidades no pasan por este filtro -- siguen "todas elegibles",
// como se decidió.
//
// Mismo mecanismo para las tres dificultades: sortea filas diversificadas
// por país, valida columnas contra el mínimo de soluciones de ese nivel, y
// repite hasta encontrar una combinación válida (o agotar los intentos).
// Lo único que cambia entre niveles es minSoluciones y el presupuesto de
// intentos -- deliberadamente simple, después de que una versión con más
// lógica (forzar columnas de país) demostrara ser frágil con datos reales.
// Para fácil, restringe la lista de equipos elegibles (ya filtrada por
// MIN_JUGADORES_EQUIPO_FILA) a los TOP_CLUBES_GRANDES_FACIL con más
// plantilla histórica registrada. Para medio/dificil no se toca nada --
// devuelve la lista completa, exactamente igual que antes de este cambio.
function equiposCandidatosPara(
  dificultad: Dificultad,
  equiposBase: string[],
  indice: Indice
): string[] {
  if (dificultad !== "facil") return equiposBase;

  return [...equiposBase]
    .sort((a, b) => indice.jugadoresPorEquipo.get(b)!.size - indice.jugadoresPorEquipo.get(a)!.size)
    .slice(0, TOP_CLUBES_GRANDES_FACIL);
}

function generarCombinacion(indice: Indice, dificultad: Dificultad): { filas: string[]; columnas: Candidata[] } | null {
  const minSoluciones = MIN_SOLUCIONES_POR_DIFICULTAD[dificultad];

  const equiposElegiblesBase = [...indice.jugadoresPorEquipo.entries()]
    .filter(([equipo]) => indice.equiposElegibles.has(equipo))
    .filter(([, jugadores]) => jugadores.size >= MIN_JUGADORES_EQUIPO_FILA)
    .map(([equipo]) => equipo);

  const clubesCandidatosFila = equiposCandidatosPara(dificultad, equiposElegiblesBase, indice);

  if (clubesCandidatosFila.length < LADO) return null;

  const nacionalidadesCandidatas = [...indice.totalPorNacionalidad.entries()]
    .filter(([, total]) => total >= MIN_JUGADORES_NACIONALIDAD)
    .map(([nacionalidad]) => nacionalidad);

  // Las columnas de tipo "equipo" salen del MISMO pool restringido que las
  // filas en fácil -- así cualquier club que aparezca en el tablero (fila o
  // columna) es uno "grande", garantizando el solape que hace cumplir
  // minSoluciones sin depender de un umbral muy ajustado.
  const poolColumnas: Candidata[] = [
    ...clubesCandidatosFila.map((valor) => ({ tipo: "equipo", valor }) as Candidata),
    ...nacionalidadesCandidatas.map((valor) => ({ tipo: "nacionalidad", valor }) as Candidata),
  ];

  for (let i = 0; i < INTENTOS_CON_DIVERSIDAD[dificultad]; i++) {
    const filas = elegirFilasDiversificadas(clubesCandidatosFila, indice);
    const columnasValidas = columnasValidasPara(filas, poolColumnas, minSoluciones, indice);
    if (columnasValidas.length >= LADO) return { filas, columnas: columnasValidas.slice(0, LADO) };
  }

  for (let i = 0; i < INTENTOS_FALLBACK[dificultad]; i++) {
    const filas = barajar(clubesCandidatosFila).slice(0, LADO);
    const columnasValidas = columnasValidasPara(filas, poolColumnas, minSoluciones, indice);
    if (columnasValidas.length >= LADO) return { filas, columnas: columnasValidas.slice(0, LADO) };
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

export async function generarTableroDesdeBD(dificultad: Dificultad = "dificil"): Promise<Tablero> {
  const indice = await construirIndice();
  const combinacion = generarCombinacion(indice, dificultad);

  if (!combinacion) {
    throw new Error(
      "No se ha podido generar un tablero solucionable con los datos actuales. Sincroniza más jugadores/equipos e inténtalo de nuevo."
    );
  }

  const condicionesFila = combinacion.filas.map(
    (valor) =>
      ({
        tipo: "equipo",
        valor,
        escudo: indice.escudoPorEquipo.get(valor) ?? null,
      }) as Condicion
  ) as [Condicion, Condicion, Condicion];
  const condicionesColumna = combinacion.columnas.map(
    (c) =>
      ({
        tipo: c.tipo,
        valor: c.valor,
        escudo: c.tipo === "equipo" ? (indice.escudoPorEquipo.get(c.valor) ?? null) : undefined,
      }) as Condicion
  ) as [Condicion, Condicion, Condicion];

  return { condicionesFila, condicionesColumna, celdas: celdasVacias() };
}