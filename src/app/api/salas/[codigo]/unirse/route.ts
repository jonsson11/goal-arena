// src/app/api/salas/[codigo]/unirse/route.ts
//
// POST -> el usuario con sesión activa se une a la sala con este código.
// Idempotente: si ya estaba dentro (p. ej. recarga la página de sala de
// espera), simplemente devuelve el estado actual en vez de dar error.

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
    return NextResponse.json({ error: "Ese código no corresponde a ninguna sala." }, { status: 404 });
  }

  const yaDentro = sala.jugadores.some((sj) => sj.userId === user.id);
  if (yaDentro) {
    return NextResponse.json(serializarSala(sala));
  }

  if (sala.estado !== "ESPERANDO") {
    return NextResponse.json({ error: "Esta partida ya ha empezado." }, { status: 400 });
  }

  if (sala.jugadores.length >= sala.maxJugadores) {
    return NextResponse.json({ error: "La sala está llena." }, { status: 400 });
  }

  await prisma.salaJugador.create({
    data: { salaId: sala.id, userId: user.id, listo: false },
  });

  const salaActualizada = await prisma.sala.findUnique({
    where: { id: sala.id },
    include: SALA_INCLUDE_JUGADORES,
  });

  return NextResponse.json(serializarSala(salaActualizada!));
}