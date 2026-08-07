import type { Usuario } from "./type";

// OJO: `estadisticasRapidas` y `historialPartidas` (partidas jugadas, %
// acierto, rachas, historial...) que vivían aquí como datos de mentira se
// quitaron a propósito -- ahora ProfileView pide todo eso de verdad a
// GET /api/perfil/estadisticas (ver ese archivo, y POST /api/partidas,
// que es quien va rellenando esos datos partida a partida).
//
// `logros` (mock, ya borrado el 07/08/2026) siguió el mismo camino: los
// logros de verdad viven en src/lib/logros.ts (catálogo) +
// src/lib/progresoLogros.ts (progreso real por usuario), ver la pestaña
// "Logros" de ProfileView.tsx.

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