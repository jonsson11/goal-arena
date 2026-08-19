// src/app/api/ranked/estado/route.ts
//
// GET -> datos del hub competitivo (/multijugador/ranked): trofeos
// actuales y las últimas 5 partidas de Grid Ranked jugadas, con el rival
// y el cambio de trofeos de cada una. No incluye nada de la cola en sí
// (eso vive en /api/ranked/cola) -- esto es solo "para pintar el hub al
// entrar", una foto fija en el momento de la petición.

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

const LIMITE_HISTORIAL = 5;

export async function GET() {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const perfil = await prisma.user.findUnique({ where: { id: user.id }, select: { trofeos: true } });
  if (!perfil) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  // Ranked es siempre 1vs1 -- cada SalaJugador tiene como mucho un rival
  // en la misma sala, así que basta con traer los jugadores de la sala e
  // ignorar el propio.
  const misPartidas = await prisma.salaJugador.findMany({
    where: { userId: user.id, resultado: { not: null }, sala: { competitiva: true } },
    orderBy: { sala: { createdAt: "desc" } },
    take: LIMITE_HISTORIAL,
    include: {
      sala: {
        select: {
          codigo: true,
          createdAt: true,
          jugadores: {
            select: {
              userId: true,
              user: { select: { nombre: true, avatar: true, avatarTipo: true } },
            },
          },
        },
      },
    },
  });

  const historial = misPartidas.map((sj) => {
    const rivalSj = sj.sala.jugadores.find((j) => j.userId !== user.id);
    return {
      codigoSala: sj.sala.codigo,
      fecha: sj.sala.createdAt.toISOString(),
      resultado: sj.resultado as "VICTORIA" | "DERROTA" | "EMPATE",
      trofeosCambio: sj.trofeosCambio ?? 0,
      rival: rivalSj
        ? {
            nombre: rivalSj.user.nombre,
            avatar: rivalSj.user.avatar,
            avatarTipo: rivalSj.user.avatarTipo === "FOTO" ? ("foto" as const) : ("emoji" as const),
          }
        : null,
    };
  });

  return NextResponse.json({ trofeos: perfil.trofeos, historial });
}
