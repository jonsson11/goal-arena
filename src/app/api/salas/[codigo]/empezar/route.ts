// src/app/api/salas/[codigo]/empezar/route.ts
//
// POST -> el creador empieza la partida: exige que haya al menos 2
// jugadores y que TODOS (creador incluido) estén "listo". El tablero ya
// se generó y fijó al crear la sala (ver /api/salas), así que aquí solo
// se marca el inicio -- `estado` pasa a EN_CURSO, pero `empezadaEn` se
// deja en null a propósito (12/08/2026, arreglo de sincronización): ya no
// se fija aquí mismo con un margen fijo de unos segundos, sino más
// adelante, en cuanto conste que TODOS los jugadores ya cargaron la
// pantalla de partida (ver marcarCargadoYArrancarCuentaAtrasSiToca en
// src/lib/salas.ts) -- así la cuenta atrás 3-2-1 la ve completa todo el
// mundo, en vez de que quien tarde más en enterarse (por el intervalo de
// polling de esta sala de espera) aterrice con la cuenta atrás ya casi
// agotada. `enCursoDesde` sí se fija ya mismo, como ancla del margen de
// seguridad (ver SEGUNDOS_LIMITE_CARGA) por si alguien nunca llega a
// cargar la pantalla de partida.

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

  const salaActualizada = await prisma.$transaction(async (tx) => {
    await tx.salaJugador.updateMany({ where: { salaId: sala.id }, data: { cargado: false } });

    return tx.sala.update({
      where: { id: sala.id },
      data: { estado: "EN_CURSO", empezadaEn: null, enCursoDesde: new Date() },
      include: SALA_INCLUDE_JUGADORES,
    });
  });

  return NextResponse.json(serializarSala(salaActualizada));
}