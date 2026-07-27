// src/app/api/tablero/generar/route.ts
import { NextResponse } from "next/server";
import { generarTableroDesdeBD } from "@/features/games/grid/generarTablero.server";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const tablero = await generarTableroDesdeBD();
    return NextResponse.json(tablero);
  } catch (err) {
    console.error("GET /api/tablero/generar: fallo al generar tablero", err);
    const mensaje = err instanceof Error ? err.message : "Error desconocido al generar el tablero.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }
}