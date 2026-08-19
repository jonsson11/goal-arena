export type TipoAvatar = "emoji" | "foto";

export type Usuario = {
  id: string;
  nombre: string;
  email: string;
  avatar: string; // emoji, de momento
  avatarTipo: TipoAvatar,
  nivel: number;
  xpActual: number;
  xpSiguienteNivel: number;

  // Modo competitivo (Grid Ranked, Fase 9) -- sistema totalmente aparte
  // del nivel/EXP de arriba. La liga (Canterano/Amateur/.../Leyenda) no
  // viaja aquí: se deriva de `trofeos` en el cliente con `ligaPorTrofeos()`
  // (src/lib/trofeos.ts), igual que ya se deriva en el servidor.
  trofeos: number;
};

export type ResultadoPartida = "victoria" | "derrota";

// Forma real de GET /api/perfil/estadisticas (ver ese archivo) --esto
// reemplaza a los antiguos EstadisticasRapidas/PartidaHistorial de
// mentira que vivían aquí.
export type DesgloseModo = {
  clave: string;
  etiqueta: string;
  partidasJugadas: number;
  porcentajeVictoria: number;
};

export type PartidaHistorial = {
  id: string;
  juego: string;
  modo: string | null;
  etiqueta: string;
  resultado: ResultadoPartida;
  expGanada: number;
  fecha: string; // ISO
};

export type EstadisticasPerfil = {
  total: {
    partidasJugadas: number;
    porcentajeVictoria: number;
  };
  rachaActual: number;
  rachaMaxima: number;
  // % de victoria por JUEGO nada más, sin desglosar por dificultad
  // (12/08/2026, petición del usuario) -- misma forma que DesgloseModo,
  // `clave` es "LINKPLAYERS" | "GRID" | "TOP10" en vez de "GRID:facil".
  porJuego: DesgloseModo[];
  porModo: DesgloseModo[];
  historial: PartidaHistorial[];
};

