// src/app/api/tablero/generar/route.ts
import { NextResponse } from "next/server";
import { generarTableroDesdeBD } from "@/features/games/grid/generarTablero.server";
import type { Dificultad } from "@/features/games/shared/types";

export const dynamic = "force-dynamic";

const DIFICULTADES_VALIDAS: Dificultad[] = ["facil", "medio", "dificil"];

function parsearDificultad(valor: string | null): Dificultad {
  return DIFICULTADES_VALIDAS.includes(valor as Dificultad) ? (valor as Dificultad) : "dificil";
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const dificultad = parsearDificultad(searchParams.get("dificultad"));

    const tablero = await generarTableroDesdeBD(dificultad);
    return NextResponse.json(tablero);
  } catch (err) {
    console.error("GET /api/tablero/generar: fallo al generar tablero", err);
    const mensaje = err instanceof Error ? err.message : "Error desconocido al generar el tablero.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}