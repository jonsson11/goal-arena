// src/app/api/top10/generar/route.ts

import { NextResponse } from "next/server";
import { generarTop10DesdeBD } from "@/features/games/top10/generarTop10.server";

// El ranking es aleatorio: sin esto, Next podría cachear la primera
// respuesta y servir siempre el mismo Top 10.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const excluir = new URL(request.url).searchParams.get("excluir") ?? undefined;

  try {
    const ranking = await generarTop10DesdeBD(excluir);
    return NextResponse.json(ranking);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "No se pudo generar el Top 10." },
      { status: 500 }
    );
  }
}