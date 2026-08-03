export type Equipo = {
  nombre: string;
  pais: string;
  escudo: string;
};

// Nivel de dificultad del 3x3 (y, a futuro, de cualquier otro minijuego que
// quiera reutilizar el mismo selector). "dificil" es el comportamiento
// original del juego -- sin ningún mínimo de respuestas posibles por
// casilla, solo se exige que exista al menos una.
export type Dificultad = "facil" | "medio" | "dificil";

export type Jugador = {
  nombre: string;
  fechaNacimiento: string;
  equipos: Equipo[];
  nacionalidad: string;
  valorDeMercado: number;
  goles: number;
  asistencias: number;
  partidos: number;
  imagenUrl: string | null;
};