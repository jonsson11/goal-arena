// src/app/api/perfil/estadisticas/route.ts
//
// GET -> estadísticas reales del usuario con sesión activa: partidas
// jugadas y % de victoria, tanto en total como desglosado por modo
// (GRID fácil/medio/difícil, TOP10), más las últimas partidas jugadas
// para el historial del perfil.
//
// Todo sale de PartidaJugada -- los contadores denormalizados en User
// (partidasJugadas, rachaActual, rachaMaxima) siguen sirviendo para la
// carga rápida del nivel (ver /api/auth/me), pero el desglose por modo
// necesita agrupar, así que aquí sí se consulta la tabla de verdad.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const ETIQUETA_MODO: Record<string, string> = {
  "GRID:facil": "Grid · Fácil",
  "GRID:medio": "Grid · Medio",
  "GRID:dificil": "Grid · Difícil",
  "TOP10:": "Top 10",
};

const LIMITE_HISTORIAL = 8;

export async function GET() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const [agrupado, recientes, perfil] = await Promise.all([
    prisma.partidaJugada.groupBy({
      by: ["juego", "modo", "resultado"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
    prisma.partidaJugada.findMany({
      where: { userId: user.id },
      orderBy: { jugadaEn: "desc" },
      take: LIMITE_HISTORIAL,
      select: { id: true, juego: true, modo: true, resultado: true, expGanada: true, jugadaEn: true },
    }),
    // rachaActual/rachaMaxima no se pueden sacar de un groupBy (son sobre
    // el ORDEN de las partidas, no un conteo) -- se mantienen aparte, en
    // User, actualizadas por POST /api/partidas en cada partida.
    prisma.user.findUnique({
      where: { id: user.id },
      select: { rachaActual: true, rachaMaxima: true },
    }),
  ]);

  // agrupado trae una fila por (juego, modo, resultado) -- se combinan en
  // un mapa por (juego, modo) con jugadas/victorias, más un acumulado total.
  type Acumulado = { jugadas: number; victorias: number };
  const porModo = new Map<string, Acumulado>();
  const total: Acumulado = { jugadas: 0, victorias: 0 };

  for (const fila of agrupado) {
    const clave = `${fila.juego}:${fila.modo ?? ""}`;
    const entrada = porModo.get(clave) ?? { jugadas: 0, victorias: 0 };
    entrada.jugadas += fila._count._all;
    if (fila.resultado === "VICTORIA") entrada.victorias += fila._count._all;
    porModo.set(clave, entrada);

    total.jugadas += fila._count._all;
    if (fila.resultado === "VICTORIA") total.victorias += fila._count._all;
  }

  function porcentaje(a: Acumulado): number {
    return a.jugadas === 0 ? 0 : Math.round((a.victorias / a.jugadas) * 100);
  }

  const porModoOrdenado = [...porModo.entries()]
    .sort((a, b) => b[1].jugadas - a[1].jugadas)
    .map(([clave, datos]) => ({
      clave,
      etiqueta: ETIQUETA_MODO[clave] ?? clave,
      partidasJugadas: datos.jugadas,
      porcentajeVictoria: porcentaje(datos),
    }));

  return NextResponse.json({
    total: {
      partidasJugadas: total.jugadas,
      porcentajeVictoria: porcentaje(total),
    },
    rachaActual: perfil?.rachaActual ?? 0,
    rachaMaxima: perfil?.rachaMaxima ?? 0,
    porModo: porModoOrdenado,
    historial: recientes.map((p) => ({
      id: p.id,
      juego: p.juego,
      modo: p.modo,
      etiqueta: ETIQUETA_MODO[`${p.juego}:${p.modo ?? ""}`] ?? p.juego,
      resultado: p.resultado === "VICTORIA" ? "victoria" : "derrota",
      expGanada: p.expGanada,
      fecha: p.jugadaEn,
    })),
  });
}
