export type Amigo = {
  id: string;
  nombre: string;
  avatar: string;
  nivel: number;
  enLinea: boolean;
};

export type SolicitudAmistad = {
  id: string;
  nombre: string;
  avatar: string;
  nivel: number;
};

export type EstadisticasPublicas = {
  partidasJugadas: number;
  porcentajeAcierto: number;
  rachaMaxima: number;
};