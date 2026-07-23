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