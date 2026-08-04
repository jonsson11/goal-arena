// src/app/api/partidas/route.ts
//
// POST { juego, modo?, resultado } -> registra una partida terminada
// (victoria o derrota) del usuario con sesión activa, le suma la EXP que
// corresponda (0 en derrota) y devuelve el "antes" y "después" de su
// nivel para que el cliente pueda animar la barra en el cartel de
// resultado (ver ExperienciaGanada.tsx).
//
// Solo victorias dan EXP. La primera victoria del día (cualquier modo)
// suma además el bonus diario -- ver src/lib/experiencia.ts.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import {
  esCombinacionValida,
  expBasePorVictoria,
  estaDisponibleBonusDiario,
  aplicarExperiencia,
  BONUS_DIARIO_EXP,
  type JuegoPartida,
} from "@/lib/experiencia";

type Body = {
  juego?: string;
  modo?: string | null;
  resultado?: "victoria" | "derrota";
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
    const expBase = esVictoria ? expBasePorVictoria(juego as JuegoPartida, modo) : 0;
    const bonusDiario = esVictoria && estaDisponibleBonusDiario(actual.ultimoBonusDiario, ahora);
    const expGanada = expBase + (bonusDiario ? BONUS_DIARIO_EXP : 0);

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

    return { estadoAntes, estadoDespues, expBase, bonusDiario, expGanada };
  });

  return NextResponse.json(resultadoFinal);
}
