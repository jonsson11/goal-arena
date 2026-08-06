import type { TipoAvatar } from "@/features/profile/type";
import type { Dificultad } from "@/features/games/shared/types";

// Igual que PartidaJugada.juego -- texto libre, no enum. Hoy solo GRID
// soporta multijugador; TOP10 se añade en una fase posterior sin migrar
// nada, reutilizando este mismo modelo de Sala.
export type JuegoMultijugador = "GRID";

export const JUEGOS_MULTIJUGADOR_DISPONIBLES: JuegoMultijugador[] = ["GRID"];

export type EstadoSala = "ESPERANDO" | "EN_CURSO" | "FINALIZADA" | "CANCELADA";

export type JugadorSala = {
  id: string; // id de usuario, no de la fila SalaJugador
  nombre: string;
  avatar: string;
  avatarTipo: TipoAvatar;
  listo: boolean;
  esCreador: boolean;
};

export type Sala = {
  codigo: string;
  juego: JuegoMultijugador;
  dificultad: Dificultad | null;
  maxJugadores: number;
  estado: EstadoSala;
  creadorId: string;
  jugadores: JugadorSala[];
};