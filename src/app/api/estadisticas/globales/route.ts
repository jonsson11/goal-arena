// src/app/api/estadisticas/globales/route.ts
//
// GET -> estadísticas públicas y agregadas de toda la plataforma, para la
// sección de cifras del Inicio (StatsSection.tsx). Antes eran números
// inventados a mano ("1.200+ partidas", "350+ jugadores activos") -- se
// calculan aquí de verdad. Sin autenticación: son cifras públicas y
// agregadas, no exponen nada de ningún usuario en concreto.
//
// Ampliado el 07/08/2026 con las cifras de "Base de datos propia"
// (futbolistas, equipos, rankings de Top10) -- a diferencia de
// "partidas jugadas"/"jugadores activos" (que dependen de cuánta gente
// use la app, hoy todavía poca), estas son ciertas independientemente de
// eso: son el contenido de fútbol que ya tenéis cargado, y ese sí es un
// número real y ya "grande" del que presumir sin faltar a la verdad.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const [totalPartidas, totalJugadoresActivos, totalFutbolistas, totalEquipos, totalRankingsTop10] =
    await Promise.all([
      prisma.partidaJugada.count(),
      // "Activo" = ha jugado al menos una partida alguna vez -- más
      // honesto que contar cuentas registradas sin más (alguien puede
      // haberse registrado y no haber llegado a jugar).
      prisma.user.count({ where: { partidasJugadas: { gt: 0 } } }),
      prisma.player.count(),
      prisma.team.count(),
      // Solo los activos -- un ranking desactivado no está realmente
      // "disponible" para jugar, así que no debería contar como
      // contenido "cargado" de cara al usuario.
      prisma.top10Ranking.count({ where: { activo: true } }),
    ]);

  return NextResponse.json({
    totalPartidas,
    totalJugadoresActivos,
    totalFutbolistas,
    totalEquipos,
    totalRankingsTop10,
  });
}