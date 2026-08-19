// src/app/api/ranked/cosmetico/route.ts
//
// PATCH { ligaId: string | null } -> cambia qué liga se muestra como
// cosmético (aro de avatar / escudo del header y del perfil). `null`
// vuelve al modo "automático" (se enseña la liga actual en vivo, el
// comportamiento de siempre); `ARO_OCULTO` ("OCULTO") no muestra ningún
// aro, solo el avatar. Cualquier id de Liga se valida en el servidor
// contra `trofeosMaximos` -- nunca te fías del cliente para decidir si
// algo está desbloqueado (Fase 5, 19/08/2026).

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { ARO_OCULTO, LIGAS, ligaDesbloqueadaComoCosmetico } from "@/lib/trofeos";
import type { Usuario } from "@/features/profile/type";

export async function PATCH(request: Request) {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  let body: { ligaId?: string | null };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const ligaId = body.ligaId ?? null;

  if (ligaId !== null && ligaId !== ARO_OCULTO) {
    const liga = LIGAS.find((l) => l.id === ligaId);
    if (!liga) {
      return NextResponse.json({ error: "Esa liga no existe." }, { status: 400 });
    }

    const perfilActual = await prisma.user.findUnique({
      where: { id: user.id },
      select: { trofeosMaximos: true },
    });
    if (!perfilActual) {
      return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
    }
    if (!ligaDesbloqueadaComoCosmetico(liga.id, perfilActual.trofeosMaximos)) {
      return NextResponse.json({ error: "Todavía no has desbloqueado esa liga." }, { status: 400 });
    }
  }

  const perfil = await prisma.user.update({
    where: { id: user.id },
    data: { aroEquipado: ligaId },
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
    trofeos: perfil.trofeos,
    trofeosMaximos: perfil.trofeosMaximos,
    aroEquipado: perfil.aroEquipado,
  };

  return NextResponse.json({ usuario });
}
