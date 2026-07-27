// src/app/api/jugadores/buscar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import type { Jugador } from "@/features/games/shared/types";

// Evita cachear resultados de búsqueda entre peticiones
export const dynamic = "force-dynamic";

// Debe coincidir con MIN_CHARS de PlayerSearch.tsx.
// TODO: extraer a una constante compartida si esto se descoordina.
const MIN_QUERY_LENGTH = 2;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json([]);
  }

  try {
    const players = await prisma.player.findMany({
      where: {
        nombre: { contains: q, mode: "insensitive" },
      },
      include: {
        stints: {
          include: { team: true },
          orderBy: { startDate: "asc" },
        },
      },
      take: 8,
    });

    const jugadores: Jugador[] = players.map((player) => ({
      nombre: player.nombre,
      fechaNacimiento: player.fechaNacimiento
        ? player.fechaNacimiento.toISOString().split("T")[0]
        : "",
      nacionalidad: player.nacionalidad,
      valorDeMercado: player.valorDeMercado,
      goles: player.goles,
      asistencias: player.asistencias,
      partidos: player.partidos,
      equipos: player.stints.map((stint) => ({
        nombre: stint.team.nombre,
        pais: stint.team.pais,
        escudo: stint.team.escudo ?? "",
      })),
    }));

    return NextResponse.json(jugadores);
  } catch (err) {
    console.error("GET /api/jugadores/buscar: fallo al consultar la BD", err);
    return NextResponse.json(
      { error: "No se pudo completar la búsqueda." },
      { status: 500 }
    );
  }
}