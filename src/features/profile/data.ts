import type { Usuario, EstadisticasRapidas, PartidaHistorial, Logro } from "./type";
import type { Amigo } from "./type";

export const amigos: Amigo[] = [];

export const usuarioInicial: Usuario = {
  nombre: "Jugador",
  avatar: "⚽",
  avatarTipo: "emoji",
  nivel: 7,
  xpActual: 320,
  xpSiguienteNivel: 500,
};

export const estadisticasRapidas: EstadisticasRapidas = {
  partidasJugadas: 42,
  porcentajeAcierto: 68,
  rachaActual: 5,
  rachaMaxima: 12,
};

export const historialPartidas: PartidaHistorial[] = [
  { id: "1", juego: "3x3", resultado: "victoria", detalle: "9/9 casillas", fecha: "Hoy" },
  { id: "2", juego: "Higher or Lower", resultado: "victoria", detalle: "Racha de 8", fecha: "Hoy" },
  { id: "3", juego: "Top 10", resultado: "derrota", detalle: "6/10 acertados", fecha: "Ayer" },
  { id: "4", juego: "3x3", resultado: "derrota", detalle: "5/9 casillas", fecha: "Ayer" },
  { id: "5", juego: "Higher or Lower", resultado: "victoria", detalle: "Racha de 4", fecha: "Hace 2 días" },
];

export const AVATARES_DISPONIBLES: string[] = ["⚽", "🥅", "🧤", "🏆", "🔥", "🦁", "🐐", "⭐"];

export const logros: Logro[] = [
  { id: "primera-victoria", nombre: "Primera victoria", descripcion: "Gana tu primera partida", icono: "🥇", desbloqueado: true },
  { id: "racha-10", nombre: "Racha de 10", descripcion: "Consigue una racha de 10 en Higher or Lower", icono: "🔥", desbloqueado: true },
  { id: "grid-perfecto", nombre: "Grid perfecto", descripcion: "Completa un 3x3 sin fallar ni una vez", icono: "🎯", desbloqueado: false },
  { id: "nivel-25", nombre: "Nivel 25", descripcion: "Alcanza el nivel 25", icono: "⭐", desbloqueado: false },
  { id: "top10-completo", nombre: "Sabelotodo", descripcion: "Completa un Top 10 en menos de 60 segundos", icono: "🧠", desbloqueado: false },
];