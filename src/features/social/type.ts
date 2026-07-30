import type { TipoAvatar } from "@/features/profile/type";

export type Amigo = {
  id: string;
  nombre: string;
  avatar: string;
  avatarTipo: TipoAvatar;
  nivel: number;
  enLinea: boolean;
};

export type SolicitudAmistad = {
  /** id de la fila Friendship (hace falta para aceptar/rechazar), no del usuario. */
  id: string;
  nombre: string;
  avatar: string;
  avatarTipo: TipoAvatar;
  nivel: number;
};

export type EstadisticasPublicas = {
  partidasJugadas: number;
  porcentajeAcierto: number;
  rachaMaxima: number;
};
