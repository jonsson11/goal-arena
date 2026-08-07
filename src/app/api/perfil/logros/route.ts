// src/app/api/perfil/logros/route.ts
//
// GET -> los 32 logros del catálogo, con el progreso real del usuario con
// sesión activa y su estado (bloqueado / reclamable / reclamado) en cada
// uno. Ver src/lib/progresoLogros.ts para cómo se calcula.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { obtenerLogrosConProgreso } from "@/lib/progresoLogros";

export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const logros = await obtenerLogrosConProgreso(user.id);
  return NextResponse.json({ logros });
}