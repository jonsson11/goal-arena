// src/app/api/jugadores/buscar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizarTexto";
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

    // No usamos "contains" de Postgres como filtro principal: ILIKE no
    // ignora acentos, y no queremos depender ahora mismo de activar la
    // extensión `unaccent` en Supabase. Con el volumen de jugadores
    // actual, traer los nombres y filtrar en JS con el MISMO normalizador
    // que usa PlayerSearch es más simple y garantiza el mismo
    // comportamiento en la búsqueda local (mock) y en la real (BD).
    //
    // TODO: si Player crece a varios miles de filas, esto deja de ser
    // eficiente. En ese momento: activar `unaccent` en Postgres
    // (Supabase → Database → Extensions) y mover el filtro a la query
    // con `unaccent(nombre) ILIKE unaccent('%q%')`.
    const candidatos = await prisma.player.findMany({
      select: { nombre: true },
    });

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

    // "in" no respeta el orden de nombresCoincidentes, así que reordenamos
    // para que el más relevante (según nuestro filtro) siga saliendo primero.
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