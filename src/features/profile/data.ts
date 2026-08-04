import type { Usuario, Logro } from "./type";

// OJO: `estadisticasRapidas` y `historialPartidas` (partidas jugadas, %
// acierto, rachas, historial...) que vivían aquí como datos de mentira se
// quitaron a propósito -- ahora ProfileView pide todo eso de verdad a
// GET /api/perfil/estadisticas (ver ese archivo, y POST /api/partidas,
// que es quien va rellenando esos datos partida a partida).

export const usuarioInicial: Usuario = {
  id: "usuario-de-mentira",
  nombre: "Jugador",
  email:"jugador@goalarena.com",
  avatar: "⚽",
  avatarTipo: "emoji",
  nivel: 7,
  xpActual: 320,
  xpSiguienteNivel: 500,
};

export const AVATARES_DISPONIBLES: string[] = ["⚽", "🥅", "🧤", "🏆", "🔥", "🦁", "🐐", "⭐"];

export const logros: Logro[] = [
  { id: "primera-victoria", nombre: "Primera victoria", descripcion: "Gana tu primera partida", icono: "🥇", desbloqueado: true },
  { id: "racha-10", nombre: "Racha de 10", descripcion: "Consigue una racha de 10 en Higher or Lower", icono: "🔥", desbloqueado: true },
  { id: "grid-perfecto", nombre: "Grid perfecto", descripcion: "Completa un 3x3 sin fallar ni una vez", icono: "🎯", desbloqueado: false },
  { id: "nivel-25", nombre: "Nivel 25", descripcion: "Alcanza el nivel 25", icono: "⭐", desbloqueado: false },
  { id: "top10-completo", nombre: "Sabelotodo", descripcion: "Completa un Top 10 en menos de 60 segundos", icono: "🧠", desbloqueado: false },
];