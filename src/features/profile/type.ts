export type TipoAvatar = "emoji" | "foto";

export type Usuario = {
  nombre: string;
  email: string;
  avatar: string; // emoji, de momento
  avatarTipo: TipoAvatar,
  nivel: number;
  xpActual: number;
  xpSiguienteNivel: number;

};

export type EstadisticasRapidas = {
  partidasJugadas: number;
  porcentajeAcierto: number;
  rachaActual: number;
  rachaMaxima: number;
};

export type ResultadoPartida = "victoria" | "derrota";

export type PartidaHistorial = {
  id: string;
  juego: string;
  resultado: ResultadoPartida;
  detalle: string;
  fecha: string;
};

export type Logro = {
  id: string;
  nombre: string;
  descripcion: string;
  icono: string;
  desbloqueado: boolean;
};

