export type Equipo = {
  nombre: string;
  pais: string;
  escudo: string;
  // Años de la etapa en este club ("actualidad" si sigue en curso) --
  // opcionales porque no todos los consumidores de `Jugador.equipos` los
  // necesitan (Grid solo mira `nombre`), pero PlayerSearch los usa para
  // enseñar las etapas de cada candidato como pista (12/08/2026, petición
  // del usuario para LinkPlayers: "me parece complicadísimo", ver
  // mostrarEtapas en PlayerSearch.tsx). Vienen ya rellenos desde
  // /api/jugadores/buscar.
  desde?: string;
  hasta?: string;
  // Probable cesión (12/08/2026, 2ª ronda): mismo criterio que ya usan
  // las tarjetas de inicio/final de LinkPlayers -- esta etapa se solapa
  // en el tiempo con otra etapa anterior (de otro club) del jugador. Lo
  // calcula /api/jugadores/buscar; opcional por lo mismo que desde/hasta,
  // el resto de consumidores de Jugador.equipos no lo necesitan.
  cedido?: boolean;
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