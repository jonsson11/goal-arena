export type Equipo = {
  nombre: string;
  pais: string;
  escudo: string;
};

export type Jugador = {
  nombre: string;
  fechaNacimiento: string;
  equipos: Equipo[];
  nacionalidad: string;
};

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