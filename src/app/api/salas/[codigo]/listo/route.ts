// src/app/api/salas/[codigo]/listo/route.ts
//
// POST -> alterna (toggle) si el usuario con sesión activa está "listo"
// dentro de esta sala. El creador también puede alternarlo (aunque entra
// listo por defecto al crear la sala) por si quiere destoggle-ar mientras
// espera a que se unan más amigos, sin tener que salir y volver a entrar.

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
  if (sala.estado !== "ESPERANDO") {
    return NextResponse.json({ error: "Esta partida ya ha empezado." }, { status: 400 });
  }

  const miFila = sala.jugadores.find((sj) => sj.userId === user.id);
  if (!miFila) {
    return NextResponse.json({ error: "No estás en esa sala." }, { status: 403 });
  }

  await prisma.salaJugador.update({
    where: { id: miFila.id },
    data: { listo: !miFila.listo },
  });

  const salaActualizada = await prisma.sala.findUnique({
    where: { id: sala.id },
    include: SALA_INCLUDE_JUGADORES,
  });

  return NextResponse.json(serializarSala(salaActualizada!));
}