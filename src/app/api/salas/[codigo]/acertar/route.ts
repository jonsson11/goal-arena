// src/app/api/salas/[codigo]/acertar/route.ts
//
// POST { jugador } -> intenta acertar `jugador` contra el Top10 de MI
// sala (cada jugador de la sala resuelve el mismo ranking de forma
// independiente, igual que GRID resuelve el mismo tablero -- ver
// comentario de SalaJugador.progreso en el schema). El servidor es quien
// decide si `jugador` está en el ranking y en qué posición -- el cliente
// nunca ha visto el ranking completo (ver EstadoPartidaTop10 en
// features/multijugador/type.ts), así que no hay forma de adivinar por la
// pestaña de red qué falta.
//
// Mismo mecanismo de cierre en servidor (finalizarPartidaSiToca) que ya
// usa .../colocar (GRID) y el polling de .../partida, para el caso de que
// se acabe el tiempo sin que nadie complete el Top10 entero.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { buscarEntradaCoincidente } from "@/features/games/top10/logic";
import { finalizarPartidaSiToca, construirEstadoPartida, objetivoAciertos } from "@/lib/salas";
import type { RankingTop10 } from "@/features/games/top10/type";
import type { Jugador } from "@/features/games/shared/types";
import type { AciertoPropioTop10 } from "@/features/multijugador/type";

export const dynamic = "force-dynamic";

async function usuarioActual() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function jugadorValido(valor: unknown): valor is Jugador {
  if (!valor || typeof valor !== "object") return false;
  const j = valor as Record<string, unknown>;
  return typeof j.nombre === "string" && Array.isArray(j.equipos) && typeof j.nacionalidad === "string";
}

export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const { codigo } = await params;

  let body: { jugador?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  if (!jugadorValido(body.jugador)) {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const sala = await prisma.sala.findUnique({
    where: { codigo: codigo.toUpperCase() },
    include: { jugadores: true },
  });
  if (!sala) {
    return NextResponse.json({ error: "Esa sala no existe." }, { status: 404 });
  }
  if (sala.juego !== "TOP10") {
    return NextResponse.json({ error: "Esta sala no es de Top 10." }, { status: 400 });
  }
  if (sala.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Esta partida no está en curso." }, { status: 400 });
  }

  const mi = sala.jugadores.find((sj) => sj.userId === user.id);
  if (!mi) {
    return NextResponse.json({ error: "No estás en esa sala." }, { status: 403 });
  }

  // Misma guarda extra que .../colocar: si el timer ya venció pero nadie
  // ha hecho polling todavía para cerrar la partida, se cierra ya mismo.
  if (
    sala.empezadaEn &&
    sala.duracionSegundos &&
    Date.now() >= sala.empezadaEn.getTime() + sala.duracionSegundos * 1000
  ) {
    await finalizarPartidaSiToca(sala.id);
    return NextResponse.json({ error: "Se ha acabado el tiempo." }, { status: 400 });
  }

  if (sala.empezadaEn && Date.now() < sala.empezadaEn.getTime()) {
    return NextResponse.json({ error: "La partida todavía no ha empezado." }, { status: 400 });
  }

  const progreso = (mi.progreso as unknown as AciertoPropioTop10[]) ?? [];
  const ranking = sala.contenido as unknown as RankingTop10;

  const entrada = buscarEntradaCoincidente(ranking.respuestas, body.jugador.nombre);
  if (!entrada) {
    return NextResponse.json({ error: `${body.jugador.nombre} no está en este Top 10.` }, { status: 400 });
  }
  if (progreso.some((a) => a.entrada.nombre === entrada.nombre)) {
    return NextResponse.json({ error: `Ya habías acertado a ${entrada.nombre}.` }, { status: 400 });
  }

  const posicion = ranking.respuestas.findIndex((r) => r.nombre === entrada.nombre) + 1;
  const nuevoProgreso: AciertoPropioTop10[] = [...progreso, { posicion, entrada }];
  const objetivo = objetivoAciertos("TOP10", ranking);
  const completado = nuevoProgreso.length >= objetivo;

  await prisma.salaJugador.update({
    where: { id: mi.id },
    data: {
      progreso: nuevoProgreso,
      celdasResueltas: nuevoProgreso.length,
      ...(completado ? { terminadaEn: new Date() } : {}),
    },
  });

  // Si acabo de completar el Top10, la partida se cierra AHORA MISMO --
  // mismo criterio que GRID, no hace falta esperar al siguiente polling.
  if (completado) {
    await finalizarPartidaSiToca(sala.id);
  }

  const estado = await construirEstadoPartida(sala.id, user.id);
  return NextResponse.json(estado);
}
