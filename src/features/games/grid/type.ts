import type { Jugador } from "@/features/games/shared/types";

export type TipoCondicion = "equipo" | "nacionalidad";

export type Condicion = {
  tipo: TipoCondicion;
  valor: string;
};

export type Celda = {
  fila: number;
  columna: number;
  jugador: Jugador | null;
};

export type Tablero = {
  condicionesFila: [Condicion, Condicion, Condicion];
  condicionesColumna: [Condicion, Condicion, Condicion];
  celdas: Celda[];
};