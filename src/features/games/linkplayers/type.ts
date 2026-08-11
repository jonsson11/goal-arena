// src/features/games/linkplayers/type.ts

// Una pista de Stint para las tarjetas de jugador inicial/final --
// `temporada` es opcional a propósito: en dificultad "medio" solo se
// enseña el nombre del equipo, sin años (ver PISTAS_POR_DIFICULTAD en
// generarPartida.server.ts).
export type PistaEtapa = { equipo: string; temporada?: string };

// Ficha mínima de un jugador para mostrar en las cabeceras de "inicio" y
// "final" y en cada eslabón de la cadena -- no hace falta el resto de
// campos de Jugador (goles, valor de mercado...), ninguno se usa aquí.
//
// `pistas` solo viene en jugadorInicial/jugadorFinal (nunca en los pasos
// de la cadena que construye el jugador), y depende de la dificultad
// elegida (11/08/2026, petición del usuario): en fácil, equipo + años de
// cada etapa; en medio, solo los equipos, sin repetir; en difícil,
// undefined -- sin pistas.
export type JugadorObjetivo = {
  nombre: string;
  nacionalidad: string;
  imagenUrl: string | null;
  pistas?: PistaEtapa[];
};

// Lo que devuelve GET /api/jugadores/enlazar/generar: la pareja de
// jugadores de esta partida y la longitud de su camino más corto real
// (calculada en el servidor vía BFS sobre el grafo de Stints, ver
// grafoJugadores.server.ts) -- se enseña desde el principio, tal como se
// decidió: la gracia es tratar de igualarla, no adivinarla a ciegas.
//
// `caminoSolucion` SÍ viaja al cliente desde el principio (un camino más
// corto real, encadenado paso a paso igual que `PasoCadena`) -- no se
// enseña en pantalla hasta que el jugador se rinde (o gana), pero está en
// la respuesta desde el principio en vez de en un endpoint aparte. Mismo
// criterio que ya usa Top10 en modo individual: el dato completo viaja
// igualmente, solo se oculta en la UI hasta que toca revelarlo -- no es
// un problema real de seguridad porque, a diferencia de una Sala
// multijugador, nadie más ve la pestaña de red de tu propia partida.
export type PartidaGenerada = {
  jugadorInicial: JugadorObjetivo;
  jugadorFinal: JugadorObjetivo;
  distanciaMinima: number;
  caminoSolucion: PasoCadena[];
};

// Lo que devuelve POST /api/jugadores/enlazar/verificar. equipoComun y
// temporada solo vienen si conectados=true.
export type ResultadoConexion = {
  conectados: boolean;
  equipoComun?: string;
  temporada?: string;
};

// Un eslabón ya confirmado de la cadena que ha ido construyendo el
// jugador. El primero (el jugador inicial) no tiene `conexion` -- no hay
// paso previo con el que conectar. A partir del segundo, `conexion` es la
// prueba de que ese Step es válido (equipo y años en los que coincidieron
// con el eslabón anterior), y es lo que se enseña bajo su nombre.
export type PasoCadena = {
  jugador: JugadorObjetivo;
  conexion?: { equipo: string; temporada: string };
};
