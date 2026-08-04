// src/app/api/partidas/route.ts
//
// POST { juego, modo?, resultado, segundos? } -> registra una partida
// terminada (victoria o derrota) del usuario con sesión activa, le suma la
// EXP que corresponda (0 en derrota) y devuelve el "antes" y "después" de
// su nivel para que el cliente pueda animar la barra en el cartel de
// resultado (ver ExperienciaGanada.tsx).
//
// Solo victorias dan EXP. La primera victoria del día (cualquier modo)
// suma además el bonus diario, y completar rápido suma un % extra sobre la
// base según el modo -- `segundos` (tiempo que tardó la partida) es lo que
// hace falta para ese cálculo. Todo el reparto vive en
// calcularExperienciaVictoria() (src/lib/experiencia.ts), aquí solo se
// llama y se persiste el resultado.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  esCombinacionValida,
  estaDisponibleBonusDiario,
  calcularExperienciaVictoria,
  aplicarExperiencia,
  type JuegoPartida,
} from "@/lib/experiencia";

type Body = {
  juego?: string;
  modo?: string | null;
  resultado?: "victoria" | "derrota";
  /** Segundos que tardó la partida, para el bonus por rapidez. Opcional y
   * sin validar más allá de "es un número" -- lo manda el cliente, así que
   * no es un dato de confianza; si viene mal o no viene, simplemente no
   * hay bonus por tiempo (ver bonusPorcentajePorTiempo), no se rechaza la
   * partida entera por esto. */
  segundos?: number;
};

export async function POST(request: Request) {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  let body: Body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const juego = body.juego ?? "";
  const modo = body.modo ?? null;
  const resultado = body.resultado;
  const segundos = body.segundos;

  if (resultado !== "victoria" && resultado !== "derrota") {
    return NextResponse.json({ error: "Falta o es inválido el resultado." }, { status: 400 });
  }
  if (!esCombinacionValida(juego, modo)) {
    return NextResponse.json({ error: "Juego o modo inválido." }, { status: 400 });
  }

  const ahora = new Date();

  const resultadoFinal = await prisma.$transaction(async (tx) => {
    // Fila bloqueada hasta que termine la transacción -- si el mismo
    // usuario mandara dos partidas casi a la vez (dos pestañas, doble
    // click...), la segunda espera a la primera en vez de leer un estado
    // "antes" ya desactualizado y pisar el resultado.
    const filas = await tx.$queryRaw<
      Array<{
        nivel: number;
        xpActual: number;
        xpSiguienteNivel: number;
        partidasJugadas: number;
        rachaActual: number;
        rachaMaxima: number;
        ultimoBonusDiario: Date | null;
      }>
    >`SELECT nivel, "xpActual", "xpSiguienteNivel", "partidasJugadas", "rachaActual", "rachaMaxima", "ultimoBonusDiario"
      FROM "User" WHERE id = ${user.id} FOR UPDATE`;

    const actual = filas[0];
    if (!actual) throw new Error("Usuario no encontrado.");

    const esVictoria = resultado === "victoria";
    const bonusDiarioDisponible = esVictoria && estaDisponibleBonusDiario(actual.ultimoBonusDiario, ahora);
    const { expBase, bonusTiempoPct, expTiempoExtra, bonusDiario, expGanada } = esVictoria
      ? calcularExperienciaVictoria(juego as JuegoPartida, modo, segundos ?? 0, bonusDiarioDisponible)
      : { expBase: 0, bonusTiempoPct: 0, expTiempoExtra: 0, bonusDiario: false, expGanada: 0 };

    const estadoAntes = {
      nivel: actual.nivel,
      xpActual: actual.xpActual,
      xpSiguienteNivel: actual.xpSiguienteNivel,
    };
    const estadoDespues = expGanada > 0 ? aplicarExperiencia(estadoAntes, expGanada) : { ...estadoAntes, subioDeNivel: false };

    const nuevaRacha = esVictoria ? actual.rachaActual + 1 : 0;
    const nuevaRachaMaxima = Math.max(actual.rachaMaxima, nuevaRacha);

    await tx.user.update({
      where: { id: user.id },
      data: {
        nivel: estadoDespues.nivel,
        xpActual: estadoDespues.xpActual,
        xpSiguienteNivel: estadoDespues.xpSiguienteNivel,
        partidasJugadas: actual.partidasJugadas + 1,
        rachaActual: nuevaRacha,
        rachaMaxima: nuevaRachaMaxima,
        ...(bonusDiario ? { ultimoBonusDiario: ahora } : {}),
      },
    });

    await tx.partidaJugada.create({
      data: {
        userId: user.id,
        juego,
        modo,
        resultado: esVictoria ? "VICTORIA" : "DERROTA",
        expGanada,
        bonusDiario,
        jugadaEn: ahora,
      },
    });

    return { estadoAntes, estadoDespues, expBase, bonusTiempoPct, expTiempoExtra, bonusDiario, expGanada };
  });

  return NextResponse.json(resultadoFinal);
}
