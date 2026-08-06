// src/app/api/salas/route.ts
//
// POST { juego, dificultad?, maxJugadores } -> crea una sala nueva con el
// usuario con sesión activa como creador (y ya "listo", por haber sido
// quien la configuró). Genera el tablero (GRID) UNA sola vez aquí mismo,
// para que quede fijado y todos los jugadores que se unan vean
// exactamente el mismo reto -- no se regenera nunca más para esta sala.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { generarCodigoSalaUnico, duracionRondaSegundos } from "@/lib/salas";
import { generarTableroDesdeBD } from "@/features/games/grid/generarTablero.server";
import type { Tablero } from "@/features/games/grid/type";
import type { Dificultad } from "@/features/games/shared/types";
import { JUEGOS_MULTIJUGADOR_DISPONIBLES, type JuegoMultijugador } from "@/features/multijugador/type";

export const dynamic = "force-dynamic";

async function usuarioActual() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

const DIFICULTADES_VALIDAS: Dificultad[] = ["facil", "medio", "dificil"];
const MIN_JUGADORES = 2;
const MAX_JUGADORES = 8;

export async function POST(request: Request) {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  let body: { juego?: string; dificultad?: string; maxJugadores?: number };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const juego = body.juego as JuegoMultijugador;
  if (!JUEGOS_MULTIJUGADOR_DISPONIBLES.includes(juego)) {
    return NextResponse.json({ error: "Ese juego todavía no está disponible en multijugador." }, { status: 400 });
  }

  // Solo GRID exige dificultad hoy -- mismo criterio que PartidaJugada.modo
  // (null en juegos sin modos, como TOP10).
  let dificultad: Dificultad | null = null;
  if (juego === "GRID") {
    if (!DIFICULTADES_VALIDAS.includes(body.dificultad as Dificultad)) {
      return NextResponse.json({ error: "Dificultad no válida." }, { status: 400 });
    }
    dificultad = body.dificultad as Dificultad;
  }

  const maxJugadores = Number(body.maxJugadores);
  if (!Number.isInteger(maxJugadores) || maxJugadores < MIN_JUGADORES || maxJugadores > MAX_JUGADORES) {
    return NextResponse.json({ error: `El número de jugadores debe estar entre ${MIN_JUGADORES} y ${MAX_JUGADORES}.` }, { status: 400 });
  }

  let contenido: Tablero;
  try {
    // Hoy solo GRID -- cuando se extienda a TOP10 (Fase 8/9), aquí se
    // llamará al generador de rankings equivalente.
    contenido = await generarTableroDesdeBD(dificultad!);
  } catch (err) {
    const mensaje = err instanceof Error ? err.message : "No se pudo generar el reto de la sala.";
    return NextResponse.json({ error: mensaje }, { status: 500 });
  }

  const codigo = await generarCodigoSalaUnico();

  const sala = await prisma.sala.create({
    data: {
      codigo,
      creadorId: user.id,
      juego,
      dificultad,
      maxJugadores,
      contenido,
      // Duración de la RONDA (timer duro de la partida en sí, no de la
      // sala de espera) -- fijada ya aquí, aunque no se use hasta que
      // "Empezar partida" ponga `empezadaEn`, para que sean siempre
      // coherentes entre sí sin tener que recalcular nada en ese momento.
      duracionSegundos: juego === "GRID" ? duracionRondaSegundos(dificultad!) : null,
      // El creador entra ya como jugador de su propia sala, y ya "listo"
      // -- acaba de configurarla él mismo, no tiene sentido pedirle que
      // confirme otra vez que está listo.
      jugadores: {
        create: { userId: user.id, listo: true },
      },
    },
  });

  return NextResponse.json({ codigo: sala.codigo });
}