// src/app/api/salas/[codigo]/colocar/route.ts
//
// POST { fila, columna, jugador } -> intenta colocar `jugador` en esa
// casilla de MI tablero (cada jugador de la sala resuelve el mismo reto
// de forma independiente, ver comentario de SalaJugador.progreso en el
// schema). Validado aquí en el servidor con la misma lógica que ya usa el
// modo individual (cumpleAmbasCondiciones) -- nunca te fías del cliente
// para decir "esto es válido", el cliente solo decide QUÉ intentar.
//
// Si esta colocación completa las 9 casillas, cierra la partida al
// instante (gana quien completa primero, sin esperar a los demás) --
// mismo mecanismo de cierre en servidor (finalizarPartidaSiToca) que usa
// también el polling de /partida para el caso de que se acabe el tiempo.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { cumpleAmbasCondiciones } from "@/features/games/grid/logic";
import { finalizarPartidaSiToca, construirEstadoPartida } from "@/lib/salas";
import type { Tablero } from "@/features/games/grid/type";
import type { Jugador } from "@/features/games/shared/types";
import type { ColocacionPropia } from "@/features/multijugador/type";

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

  let body: { fila?: number; columna?: number; jugador?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const { fila, columna, jugador } = body;
  if (
    typeof fila !== "number" ||
    typeof columna !== "number" ||
    fila < 0 ||
    fila > 2 ||
    columna < 0 ||
    columna > 2 ||
    !jugadorValido(jugador)
  ) {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

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

  // Guarda extra por si el timer ya venció pero nadie ha hecho polling
  // todavía para cerrar la partida -- no se rechaza silenciosamente, se
  // cierra ya mismo y se informa.
  if (
    sala.empezadaEn &&
    sala.duracionSegundos &&
    Date.now() >= sala.empezadaEn.getTime() + sala.duracionSegundos * 1000
  ) {
    await finalizarPartidaSiToca(sala.id);
    return NextResponse.json({ error: "Se ha acabado el tiempo." }, { status: 400 });
  }

  const progreso = (mi.progreso as unknown as ColocacionPropia[]) ?? [];

  if (progreso.some((c) => c.fila === fila && c.columna === columna)) {
    return NextResponse.json({ error: "Ya has resuelto esa casilla." }, { status: 400 });
  }
  if (progreso.some((c) => c.jugador.nombre === jugador.nombre)) {
    return NextResponse.json({ error: `Ya has usado a ${jugador.nombre} en otra casilla.` }, { status: 400 });
  }

  const tablero = sala.contenido as unknown as Tablero;
  const condicionFila = tablero.condicionesFila[fila];
  const condicionColumna = tablero.condicionesColumna[columna];

  if (!cumpleAmbasCondiciones(jugador, condicionFila, condicionColumna)) {
    return NextResponse.json({ error: `${jugador.nombre} no cumple las condiciones de esa casilla.` }, { status: 400 });
  }

  const nuevoProgreso: ColocacionPropia[] = [...progreso, { fila, columna, jugador }];
  const completado = nuevoProgreso.length >= 9;

  await prisma.salaJugador.update({
    where: { id: mi.id },
    data: {
      progreso: nuevoProgreso,
      celdasResueltas: nuevoProgreso.length,
      ...(completado ? { terminadaEn: new Date() } : {}),
    },
  });

  // Si acabo de completar el tablero, la partida se cierra AHORA MISMO --
  // no hace falta esperar al siguiente polling de nadie. Si no, no pasa
  // nada más aquí: el cierre por timeout lo detecta el propio polling de
  // /partida en cualquiera de los clientes.
  if (completado) {
    await finalizarPartidaSiToca(sala.id);
  }

  const estado = await construirEstadoPartida(sala.id, user.id);
  return NextResponse.json(estado);
}