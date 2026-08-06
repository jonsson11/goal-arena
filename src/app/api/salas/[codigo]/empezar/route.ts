// src/app/api/salas/[codigo]/empezar/route.ts
//
// POST -> el creador empieza la partida: exige que haya al menos 2
// jugadores y que TODOS (creador incluido) estén "listo". El tablero ya
// se generó y fijó al crear la sala (ver /api/salas), así que aquí solo
// se marca el inicio -- `empezadaEn` es la fuente de verdad del timer
// compartido que usará la partida sincronizada (Fase 2, pendiente).
//
// La partida en sí (el tablero jugándose de verdad, sincronizado entre
// clientes) todavía no existe -- por ahora esto solo mueve la sala a
// EN_CURSO; la pantalla de partida es un aviso de "en construcción" hasta
// la Fase 2.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { serializarSala, SALA_INCLUDE_JUGADORES } from "@/lib/salas";

export const dynamic = "force-dynamic";

async function usuarioActual() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST(_request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const { codigo } = await params;

  const sala = await prisma.sala.findUnique({
    where: { codigo: codigo.toUpperCase() },
    include: SALA_INCLUDE_JUGADORES,
  });

  if (!sala) {
    return NextResponse.json({ error: "Esa sala no existe." }, { status: 404 });
  }
  if (sala.creadorId !== user.id) {
    return NextResponse.json({ error: "Solo quien creó la sala puede empezar la partida." }, { status: 403 });
  }
  if (sala.estado !== "ESPERANDO") {
    return NextResponse.json({ error: "Esta partida ya ha empezado." }, { status: 400 });
  }
  if (sala.jugadores.length < 2) {
    return NextResponse.json({ error: "Hace falta al menos otro jugador en la sala." }, { status: 400 });
  }
  if (!sala.jugadores.every((sj) => sj.listo)) {
    return NextResponse.json({ error: "Todavía hay jugadores que no están listos." }, { status: 400 });
  }

  const salaActualizada = await prisma.sala.update({
    where: { id: sala.id },
    data: { estado: "EN_CURSO", empezadaEn: new Date() },
    include: SALA_INCLUDE_JUGADORES,
  });

  return NextResponse.json(serializarSala(salaActualizada));
}