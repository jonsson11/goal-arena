// src/app/api/tablero/contar-soluciones/route.ts
import { NextResponse } from "next/server";
import { construirIndice, listarSolucionesCelda } from "@/features/games/grid/indiceEquipos.server";
import type { Condicion } from "@/features/games/grid/type";

export const dynamic = "force-dynamic";

interface PeticionCelda {
  condicionFila: Condicion;
  condicionColumna: Condicion;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as { celdas: PeticionCelda[] };

    if (!Array.isArray(body.celdas) || body.celdas.length === 0) {
      return NextResponse.json({ error: "Falta el array 'celdas'." }, { status: 400 });
    }

    const indice = await construirIndice();
    const resultados = body.celdas.map(({ condicionFila, condicionColumna }) =>
      listarSolucionesCelda(condicionFila, condicionColumna, indice)
    );

    return NextResponse.json({ resultados });
  } catch (err) {
    console.error("POST /api/tablero/contar-soluciones: fallo", err);
    return NextResponse.json({ error: "No se pudo comprobar la unicidad de las celdas." }, { status: 500 });
  }
}