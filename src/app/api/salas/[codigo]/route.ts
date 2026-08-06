// src/app/api/salas/[codigo]/route.ts
//
// GET -> estado actual de la sala (jugadores dentro, quién está listo, si
// ya ha empezado...). La pantalla de sala de espera hace polling a este
// endpoint cada pocos segundos -- no hay Supabase Realtime todavía.
// Deliberado: para "¿quién está listo?" un pequeño retraso de polling es
// imperceptible, así que no merece la pena montar tiempo real para esto.
// Donde SÍ hará falta (la Fase 2, sincronizar el progreso dentro de la
// partida en directo) es otra historia, con muchísima más sensibilidad a
// la latencia.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { serializarSala, enriquecerConAmistad, SALA_INCLUDE_JUGADORES } from "@/lib/salas";
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

  const sala = await prisma.sala.findUnique({
    where: { codigo: codigo.toUpperCase() },
    include: SALA_INCLUDE_JUGADORES,
  });

  if (!sala) {
    return NextResponse.json({ error: "Esa sala no existe." }, { status: 404 });
  }

  // Solo quienes están dentro de la sala pueden consultar su estado --
  // evita que cualquiera con sesión pueda espiar salas ajenas adivinando
  // (o probando) códigos.
  const esParticipante = sala.jugadores.some((sj) => sj.userId === user.id);
  if (!esParticipante) {
    return NextResponse.json({ error: "No estás en esa sala." }, { status: 403 });
  }

  const salaSerializada = await enriquecerConAmistad(serializarSala(sala), user.id);
  return NextResponse.json(salaSerializada);
}