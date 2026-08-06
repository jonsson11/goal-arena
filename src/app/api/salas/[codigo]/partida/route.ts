// src/app/api/salas/[codigo]/partida/route.ts
//
// GET -> estado en directo de la partida: mi tablero (condiciones + mis
// casillas resueltas) y el progreso de mis rivales (solo el contador, no
// qué han colocado -- ver comentario en RivalPartida). El cliente hace
// polling a este endpoint mientras la sala está EN_CURSO (ver nota sobre
// polling vs. Realtime en /api/salas/[codigo]/route.ts -- aquí el
// intervalo es más corto porque sí importa la sensación de "en directo").
//
// Cada llamada comprueba también si la partida tiene que cerrarse ya (se
// acabó el tiempo) -- así un timeout se resuelve solo con que CUALQUIER
// jugador siga con la pestaña abierta haciendo polling, sin depender de
// que alguien coloque algo más.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { construirEstadoPartida } from "@/lib/salas";

export const dynamic = "force-dynamic";

async function usuarioActual() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const { codigo } = await params;

  const sala = await prisma.sala.findUnique({ where: { codigo: codigo.toUpperCase() } });
  if (!sala) {
    return NextResponse.json({ error: "Esa sala no existe." }, { status: 404 });
  }
  if (sala.estado === "ESPERANDO") {
    return NextResponse.json({ error: "Esta partida todavía no ha empezado." }, { status: 400 });
  }
  if (sala.estado === "CANCELADA") {
    return NextResponse.json({ error: "Esta sala se canceló." }, { status: 400 });
  }

  const partida = await construirEstadoPartida(sala.id, user.id);
  if (!partida) {
    return NextResponse.json({ error: "No estás en esa partida." }, { status: 403 });
  }

  return NextResponse.json(partida);
}