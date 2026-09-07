// src/app/api/salas/[codigo]/rendirse/route.ts
//
// POST -> el usuario con sesión activa se rinde en una partida EN_CURSO:
// él pierde, el/los rival(es) ganan -- mismo payout de EXP/trofeos que una
// derrota/victoria normal (ver rendirsePartida en src/lib/salas.ts), pero
// sin esperar a que se complete el reto o se acabe el tiempo. Pensado para
// Ranked (botón "Abandonar partida" con confirmación, 07/09/2026), aunque
// funciona igual de bien en una Sala casual si se necesitara en el futuro.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { rendirsePartida, construirEstadoPartida } from "@/lib/salas";

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
    return NextResponse.json({ error: "Esa sala no existe." }, { status: 404 });
  }
  if (sala.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Esta partida no está en curso." }, { status: 400 });
  }

  const mi = sala.jugadores.find((sj) => sj.userId === user.id);
  if (!mi) {
    return NextResponse.json({ error: "No estás en esa sala." }, { status: 403 });
  }

  // Mismo guard que .../colocar: si todavía está en la cuenta atrás 3-2-1
  // (o en la revelación previa), no tiene sentido rendirse -- la partida
  // ni ha empezado de verdad.
  if (!sala.empezadaEn || Date.now() < sala.empezadaEn.getTime()) {
    return NextResponse.json({ error: "La partida todavía no ha empezado." }, { status: 400 });
  }

  await rendirsePartida(sala.id, user.id);

  const estado = await construirEstadoPartida(sala.id, user.id);
  return NextResponse.json(estado);
}