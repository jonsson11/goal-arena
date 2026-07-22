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