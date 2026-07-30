// src/app/api/usuarios/[nombre]/route.ts
//
// GET -> perfil PÚBLICO de un usuario por su nombre (case-insensitive).
// Solo expone lo que cualquiera puede ver de otro usuario (nombre, avatar,
// nivel, si está conectado) -- nunca el email ni nada privado.

import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { estaConectado } from "@/lib/presencia";
import type { Amigo } from "@/features/social/type";

export async function GET(_request: Request, { params }: { params: Promise<{ nombre: string }> }) {
  const { nombre } = await params;

  const perfil = await prisma.user.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" } },
  });

  if (!perfil) {
    return NextResponse.json({ error: "No se ha encontrado a ese usuario." }, { status: 404 });
  }

  const usuarioPublico: Amigo = {
    id: perfil.id,
    nombre: perfil.nombre,
    avatar: perfil.avatar,
    avatarTipo: perfil.avatarTipo === "FOTO" ? "foto" : "emoji",
    nivel: perfil.nivel,
    enLinea: estaConectado(perfil.ultimaActividad),
  };

  return NextResponse.json({ usuario: usuarioPublico });
}
