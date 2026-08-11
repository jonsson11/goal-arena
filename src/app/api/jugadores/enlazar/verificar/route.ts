// src/app/api/jugadores/enlazar/verificar/route.ts
import { NextResponse } from "next/server";
import { verificarConexion } from "@/features/games/linkplayers/grafoJugadores.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => null);
    const actual = body?.actual;
    const siguiente = body?.siguiente;

    if (typeof actual !== "string" || typeof siguiente !== "string" || !actual || !siguiente) {
      return NextResponse.json({ error: "Faltan los dos jugadores que comparar." }, { status: 400 });
    }

    const resultado = await verificarConexion(actual, siguiente);
    return NextResponse.json(resultado);
  } catch (err) {
    console.error("POST /api/jugadores/enlazar/verificar: fallo al verificar conexión", err);
    return NextResponse.json({ error: "No se pudo comprobar la conexión." }, { status: 500 });
  }
}
