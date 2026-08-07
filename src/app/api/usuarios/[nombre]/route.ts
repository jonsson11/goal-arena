// src/app/api/usuarios/[nombre]/route.ts
//
// GET -> perfil PÚBLICO de un usuario por su nombre (case-insensitive).
// Solo expone lo que cualquiera puede ver de otro usuario (nombre, avatar,
// nivel, si está conectado, estadísticas de partidas) -- nunca el email
// ni nada privado.
//
// Antes esta ruta solo devolvía los datos básicos del usuario, y
// PublicProfileView.tsx se inventaba las estadísticas (partidas jugadas,
// % de acierto, racha máxima) con una fórmula a partir del nivel
// (mockPublicProfile.ts) -- ni una sola cifra real. Ahora se calculan
// aquí de verdad, con la misma fuente (PartidaJugada) que ya usa
// /api/perfil/estadisticas para el perfil propio, solo que agregado en
// total en vez de desglosado por modo (el perfil público, a diferencia
// del propio, no necesita ese nivel de detalle).

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estaConectado } from "@/lib/presencia";
import type { Amigo, EstadisticasPublicas } from "@/features/social/type";

export async function GET(_request: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;

  const perfil = await prisma.user.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" } },
  });

  if (!perfil) {
    return NextResponse.json({ error: "No se ha encontrado a ese usuario." }, { status: 404 });
  }

  const conteoPorResultado = await prisma.partidaJugada.groupBy({
    by: ["resultado"],
    where: { userId: perfil.id },
    _count: { _all: true },
  });

  const partidasJugadas = conteoPorResultado.reduce((total, fila) => total + fila._count._all, 0);
  const victorias = conteoPorResultado.find((fila) => fila.resultado === "VICTORIA")?._count._all ?? 0;

  const usuarioPublico: Amigo = {
    id: perfil.id,
    nombre: perfil.nombre,
    avatar: perfil.avatar,
    avatarTipo: perfil.avatarTipo === "FOTO" ? "foto" : "emoji",
    nivel: perfil.nivel,
    enLinea: estaConectado(perfil.ultimaActividad),
  };

  const estadisticas: EstadisticasPublicas = {
    partidasJugadas,
    porcentajeAcierto: partidasJugadas === 0 ? 0 : Math.round((victorias / partidasJugadas) * 100),
    rachaMaxima: perfil.rachaMaxima,
  };

  return NextResponse.json({ usuario: usuarioPublico, estadisticas });
}