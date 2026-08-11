// src/app/api/jugadores/enlazar/generar/route.ts
import { NextResponse } from "next/server";
import { generarPartida } from "@/features/games/linkplayers/generarPartida.server";
import type { Dificultad } from "@/features/games/shared/types";

export const dynamic = "force-dynamic";

const DIFICULTADES_VALIDAS: readonly Dificultad[] = ["facil", "medio", "dificil"];

function dificultadValida(valor: string | null): Dificultad {
  if (valor && DIFICULTADES_VALIDAS.includes(valor as Dificultad)) return valor as Dificultad;
  return "medio"; // valor por defecto si no viene o viene raro -- nunca se rechaza la petición por esto
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dificultad = dificultadValida(searchParams.get("dificultad"));

    const partida = await generarPartida(dificultad);
    return NextResponse.json(partida);
  } catch (err) {
    console.error("GET /api/jugadores/enlazar/generar: fallo al generar partida", err);
    const mensaje = err instanceof Error ? err.message : "No se pudo generar la partida.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}
