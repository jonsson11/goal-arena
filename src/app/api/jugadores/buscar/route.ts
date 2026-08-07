// src/app/api/jugadores/buscar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizacion/normalizarTexto";
import { conCache } from "@/lib/cache";
import type { Jugador } from "@/features/games/shared/types";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTADOS = 8;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  if (q.length < MIN_QUERY_LENGTH) {
    return NextResponse.json([]);
  }

  try {
    const consultaNormalizada = normalizarTexto(q);

    // Antes esto pedía TODOS los jugadores a la base de datos en CADA
    // tecla (aunque solo fueran sus nombres, con cientos/miles de filas
    // eso se nota). Los nombres apenas cambian salvo cuando se ejecuta un
    // script de sync, así que se cachean 5 minutos -- de la segunda tecla
    // en adelante (y de la siguiente búsqueda, y la siguiente...) esto ya
    // no toca la base de datos para nada.
    const candidatos = await conCache("nombres-jugadores", 5 * 60 * 1000, () =>
      prisma.player.findMany({ select: { nombre: true } })
    );

    const nombresCoincidentes = candidatos
      .filter((c) => normalizarTexto(c.nombre).includes(consultaNormalizada))
      .map((c) => c.nombre)
      .slice(0, MAX_RESULTADOS);

    if (nombresCoincidentes.length === 0) {
      return NextResponse.json([]);
    }

    const players = await prisma.player.findMany({
      where: { nombre: { in: nombresCoincidentes } },
      include: {
        stints: {
          include: { team: true },
          orderBy: { startDate: "asc" },
        },
      },
    });

    const ordenPorNombre = new Map(nombresCoincidentes.map((n, i) => [n, i]));
    players.sort((a, b) => (ordenPorNombre.get(a.nombre) ?? 0) - (ordenPorNombre.get(b.nombre) ?? 0));

    const jugadores: Jugador[] = players.map((player) => ({
      nombre: player.nombre,
      fechaNacimiento: player.fechaNacimiento ? player.fechaNacimiento.toISOString().split("T")[0] : "",
      nacionalidad: player.nacionalidad,
      valorDeMercado: player.valorDeMercado,
      goles: player.goles,
      asistencias: player.asistencias,
      partidos: player.partidos,
      imagenUrl: player.imagenUrl,
      equipos: player.stints.map((stint) => ({
        nombre: stint.team.nombre,
        pais: stint.team.pais,
        escudo: stint.team.escudo ?? "",
      })),
    }));

    return NextResponse.json(jugadores);
  } catch (err) {
    console.error("GET /api/jugadores/buscar: fallo al consultar la BD", err);
    return NextResponse.json({ error: "No se pudo completar la búsqueda." }, { status: 500 });
  }
}