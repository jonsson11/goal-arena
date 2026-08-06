// src/app/api/salas/[codigo]/revancha/route.ts
//
// POST -> solo el creador, solo si la partida ya FINALIZÓ: genera un
// tablero nuevo (misma dificultad de antes -- cambiar de dificultad/modo
// desde la sala de espera queda para una próxima pasada, ver roadmap) y
// devuelve a todo el mundo a la sala de espera, con el progreso de la
// ronda anterior limpio y todos otra vez "no listos" salvo el propio
// creador.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generarTableroDesdeBD } from "@/features/games/grid/generarTablero.server";
import { duracionRondaSegundos, serializarSala, SALA_INCLUDE_JUGADORES } from "@/lib/salas";
import type { Dificultad } from "@/features/games/shared/types";

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

  const sala = await prisma.sala.findUnique({ where: { codigo: codigo.toUpperCase() } });
  if (!sala) {
    return NextResponse.json({ error: "Esa sala no existe." }, { status: 404 });
  }
  if (sala.creadorId !== user.id) {
    return NextResponse.json({ error: "Solo quien creó la sala puede pedir la revancha." }, { status: 403 });
  }
  if (sala.estado !== "FINALIZADA") {
    return NextResponse.json({ error: "Esta partida todavía no ha terminado." }, { status: 400 });
  }

  const dificultad = sala.dificultad as Dificultad | null;

  let contenido;
  try {
    contenido = dificultad ? await generarTableroDesdeBD(dificultad) : null;
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo generar el reto de la revancha.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }

  await prisma.$transaction([
    prisma.sala.update({
      where: { id: sala.id },
      data: {
        estado: "ESPERANDO",
        empezadaEn: null,
        contenido: contenido ?? undefined,
        duracionSegundos: dificultad ? duracionRondaSegundos(dificultad) : sala.duracionSegundos,
      },
    }),
    prisma.salaJugador.updateMany({
      where: { salaId: sala.id },
      data: { progreso: [], celdasResueltas: 0, terminadaEn: null, resultado: null, listo: false },
    }),
    // El creador vuelve a entrar ya "listo", mismo criterio que al crear
    // la sala la primera vez.
    prisma.salaJugador.updateMany({
      where: { salaId: sala.id, userId: user.id },
      data: { listo: true },
    }),
  ]);

  const salaActualizada = await prisma.sala.findUniqueOrThrow({
    where: { id: sala.id },
    include: SALA_INCLUDE_JUGADORES,
  });

  return NextResponse.json(serializarSala(salaActualizada));
}