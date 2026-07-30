// src/app/api/perfil/route.ts
//
// PATCH { nombre, avatar, avatarTipo } -> actualiza el perfil del usuario
// que tiene la sesión activa (nunca se recibe ni se confía en un id por
// parámetro -- siempre se saca de la sesión de Supabase Auth, para que
// nadie pueda editar el perfil de otra persona).

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Usuario } from "@/features/profile/type";

export async function PATCH(request: Request) {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  let body: { nombre?: string; avatar?: string; avatarTipo?: "emoji" | "foto" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  const avatar = body.avatar;
  const avatarTipo = body.avatarTipo;

  if (!nombre) {
    return NextResponse.json({ error: "El nombre no puede estar vacío." }, { status: 400 });
  }
  if (avatarTipo !== "emoji" && avatarTipo !== "foto") {
    return NextResponse.json({ error: "Tipo de avatar inválido." }, { status: 400 });
  }
  if (!avatar) {
    return NextResponse.json({ error: "Falta el avatar." }, { status: 400 });
  }

  const perfil = await prisma.user.update({
    where: { id: user.id },
    data: {
      nombre,
      avatar,
      avatarTipo: avatarTipo === "foto" ? "FOTO" : "EMOJI",
    },
  });

  const usuario: Usuario = {
    id: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    avatar: perfil.avatar,
    avatarTipo: perfil.avatarTipo === "FOTO" ? "foto" : "emoji",
    nivel: perfil.nivel,
    xpActual: perfil.xpActual,
    xpSiguienteNivel: perfil.xpSiguienteNivel,
  };

  return NextResponse.json({ usuario });
}
