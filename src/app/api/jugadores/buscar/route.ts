// src/app/api/jugadores/buscar/route.ts
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { normalizarTexto } from "@/lib/normalizacion/normalizarTexto";
import { conCache } from "@/lib/cache";
import type { Jugador } from "@/features/games/shared/types";

export const dynamic = "force-dynamic";

const MIN_QUERY_LENGTH = 2;
const MAX_RESULTADOS = 8;

// Misma lógica de detección de cesión que marcarCesiones en
// grafoJugadores.server.ts (12/08/2026, 2ª petición del usuario: el
// desplegable "Carrera" de los jugadores intermedios no marcaba
// "Cedido", solo las tarjetas de inicio/final lo hacían) -- una etapa se
// da por cedida si se solapa en el tiempo con OTRA etapa (de otro club)
// que empezó antes: típicamente el club "dueño" sigue sin fecha de fin
// mientras el jugador ya aparece en otro club. No se reutiliza la función
// de grafoJugadores.server.ts directamente porque allí trabaja sobre su
// propio tipo interno (StintCrudo, con id de equipo) construido para el
// grafo completo -- aquí basta con los Stints ya cargados de cada
// jugador.
function seSolapan(aInicio: Date, aFin: Date | null, bInicio: Date, bFin: Date | null): boolean {
  const finA = aFin ?? new Date();
  const finB = bFin ?? new Date();
  return aInicio <= finB && bInicio <= finA;
}

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
      // desde/hasta (12/08/2026): mismo formato "año - año/actualidad" que
      // ya usan las pistas de LinkPlayers (ver PistaEtapa en
      // features/games/linkplayers/type.ts) -- petición del usuario para
      // poder enseñar la carrera de cada candidato mientras busca al
      // siguiente jugador intermedio, no solo su nombre.
      //
      // cedido (12/08/2026, 2ª ronda): igual que en las tarjetas de
      // inicio/final, se compara cada etapa contra las demás etapas de
      // ESTE jugador (ya vienen todas en player.stints, no hace falta
      // volver a consultar la BD).
      equipos: player.stints.map((stint) => ({
        nombre: stint.team.nombre,
        pais: stint.team.pais,
        escudo: stint.team.escudo ?? "",
        desde: String(stint.startDate.getFullYear()),
        hasta: stint.endDate ? String(stint.endDate.getFullYear()) : "actualidad",
        cedido: player.stints.some(
          (otro) =>
            otro !== stint &&
            otro.startDate.getTime() < stint.startDate.getTime() &&
            seSolapan(stint.startDate, stint.endDate, otro.startDate, otro.endDate)
        ),
      })),
    }));

    return NextResponse.json(jugadores);
  } catch (err) {
    console.error("GET /api/jugadores/buscar: fallo al consultar la BD", err);
    return NextResponse.json({ error: "No se pudo completar la búsqueda." }, { status: 500 });
  }
}