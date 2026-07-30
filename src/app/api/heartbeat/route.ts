// src/app/api/heartbeat/route.ts
//
// POST -> marca `User.ultimaActividad = ahora` para el usuario de la
// sesión activa. AuthContext lo llama cada minuto mientras la pestaña está
// abierta y hay sesión. Sirve para aproximar "¿está conectado?" sin montar
// presencia en tiempo real: se considera conectado si esto es reciente
// (ver el cálculo en src/app/api/amigos/route.ts).

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  await prisma.user.update({
    where: { id: user.id },
    data: { ultimaActividad: new Date() },
  });

  return NextResponse.json({ ok: true });
}
