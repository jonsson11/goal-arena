// src/features/games/grid/indiceEquipos.server.ts
//
// SOLO SERVIDOR.

import { prisma } from "@/lib/prisma";
import type { Condicion } from "./type";

export const PATRON_NOMBRE_INVALIDO =
  /\b(u-?\d{1,2}|sub-?\s?\d{1,2}|under-?\d{1,2}|olympic|youth|junior|jong|primavera|juvenil|cantera|filial|academ(y|ia)|reserves?|\bii\b|\bb\b)\b/i;

export function esNombreValido(nombre: string): boolean {
  return !PATRON_NOMBRE_INVALIDO.test(nombre);
}

type StintCrudo = {
  playerId: string;
  team: { nombre: string; pais: string };
  player: { nombre: string; nacionalidad: string };
};

async function obtenerStints(): Promise<StintCrudo[]> {
  const stints = await prisma.stint.findMany({
    select: {
      playerId: true,
      team: { select: { nombre: true, pais: true } },
      player: { select: { nombre: true, nacionalidad: true } },
    },
  });

  return stints.filter((s) => esNombreValido(s.team.nombre));
}

export type Indice = {
  jugadoresPorEquipo: Map<string, Set<string>>;
  jugadoresPorNacionalidad: Map<string, Set<string>>;
  nacionalidadesPorEquipo: Map<string, Set<string>>;
  paisPorEquipo: Map<string, string>;
  totalPorNacionalidad: Map<string, number>;
  nombresPorJugador: Map<string, string>; // playerId -> nombre, para mostrar en el debug
};

export async function construirIndice(): Promise<Indice> {
  const stints = await obtenerStints();

  const jugadoresPorEquipo = new Map<string, Set<string>>();
  const jugadoresPorNacionalidad = new Map<string, Set<string>>();
  const nacionalidadesPorEquipo = new Map<string, Set<string>>();
  const paisPorEquipo = new Map<string, string>();
  const totalPorNacionalidad = new Map<string, number>();
  const nombresPorJugador = new Map<string, string>();

  for (const { playerId, team, player } of stints) {
    const equipo = team.nombre;

    if (!jugadoresPorEquipo.has(equipo)) jugadoresPorEquipo.set(equipo, new Set());
    jugadoresPorEquipo.get(equipo)!.add(playerId);
    paisPorEquipo.set(equipo, team.pais);
    nombresPorJugador.set(playerId, player.nombre);

    const nacionalidad = player.nacionalidad;
    const nacionalidadValida =
      !!nacionalidad && nacionalidad !== "Desconocida" && esNombreValido(nacionalidad);

    if (!nacionalidadValida) continue;

    if (!jugadoresPorNacionalidad.has(nacionalidad)) jugadoresPorNacionalidad.set(nacionalidad, new Set());
    jugadoresPorNacionalidad.get(nacionalidad)!.add(playerId);

    if (!nacionalidadesPorEquipo.has(equipo)) nacionalidadesPorEquipo.set(equipo, new Set());
    nacionalidadesPorEquipo.get(equipo)!.add(nacionalidad);

    totalPorNacionalidad.set(nacionalidad, (totalPorNacionalidad.get(nacionalidad) ?? 0) + 1);
  }

  return {
    jugadoresPorEquipo,
    jugadoresPorNacionalidad,
    nacionalidadesPorEquipo,
    paisPorEquipo,
    totalPorNacionalidad,
    nombresPorJugador,
  };
}

export function interseccionNoVacia(a: Set<string>, b: Set<string>): boolean {
  const [pequeno, grande] = a.size <= b.size ? [a, b] : [b, a];
  for (const item of pequeno) if (grande.has(item)) return true;
  return false;
}

function setDeCondicion(condicion: Condicion, indice: Indice): Set<string> | null {
  if (condicion.tipo === "equipo") return indice.jugadoresPorEquipo.get(condicion.valor) ?? null;
  return indice.jugadoresPorNacionalidad.get(condicion.valor) ?? null;
}

const LIMITE_NOMBRES = 40;

export type ResultadoCelda = {
  total: number;
  nombres: string[];
  truncado: boolean;
};

// Reemplaza a contarSolucionesCelda: ahora devuelve también los nombres,
// no solo el total. GridBoard sigue pudiendo usar solo `.total` para el
// autocompletado de soluciones únicas — es compatible con lo que ya había.
export function listarSolucionesCelda(
  condicionFila: Condicion,
  condicionColumna: Condicion,
  indice: Indice
): ResultadoCelda {
  const setFila = setDeCondicion(condicionFila, indice);
  const setColumna = setDeCondicion(condicionColumna, indice);
  if (!setFila || !setColumna) return { total: 0, nombres: [], truncado: false };

  const [pequeno, grande] = setFila.size <= setColumna.size ? [setFila, setColumna] : [setColumna, setFila];
  const idsCoincidentes: string[] = [];
  for (const id of pequeno) {
    if (grande.has(id)) idsCoincidentes.push(id);
  }

  const nombres = idsCoincidentes
    .map((id) => indice.nombresPorJugador.get(id) ?? "(sin nombre)")
    .sort((a, b) => a.localeCompare(b));

  return {
    total: idsCoincidentes.length,
    nombres: nombres.slice(0, LIMITE_NOMBRES),
    truncado: nombres.length > LIMITE_NOMBRES,
  };
}