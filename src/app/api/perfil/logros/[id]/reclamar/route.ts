// src/app/api/perfil/logros/[id]/reclamar/route.ts
//
// POST -> reclama el logro `id` para el usuario con sesión activa. Toda
// la validación real (¿existe? ¿ya lo tenía? ¿de verdad llega al umbral?)
// vive en reclamarLogro (src/lib/progresoLogros.ts) -- aquí solo se
// resuelve quién es el usuario y se traduce el resultado a HTTP.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { reclamarLogro } from "@/lib/progresoLogros";

export const dynamic = "force-dynamic";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const { id } = await params;
  const resultado = await reclamarLogro(user.id, id);

  if (!resultado.ok) {
    return NextResponse.json({ error: resultado.error }, { status: 400 });
  }

  return NextResponse.json(resultado.respuesta);
}