// src/app/api/salas/[codigo]/salir/route.ts
//
// POST -> el usuario con sesión activa abandona la sala. Si es el creador
// quien sale, la sala entera se cancela (no se reasigna el rol a otro
// jugador) -- decisión MVP a propósito, para no complicar la Fase 1 con
// una transferencia de "quién manda"; se puede revisar más adelante si en
// la práctica resulta incómodo.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

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
    include: { jugadores: true },
  });

  if (!sala) {
    return NextResponse.json({ ok: true }); // ya no existe, nada que salir
  }

  const miFila = sala.jugadores.find((sj) => sj.userId === user.id);
  if (!miFila) {
    return NextResponse.json({ ok: true }); // no estaba dentro, nada que hacer
  }

  if (sala.creadorId === user.id) {
    // onDelete: Cascade en SalaJugador se encarga de limpiar las filas de
    // los demás jugadores al borrar la sala.
    await prisma.sala.delete({ where: { id: sala.id } });
  } else {
    await prisma.salaJugador.delete({ where: { id: miFila.id } });
  }

  return NextResponse.json({ ok: true });
}