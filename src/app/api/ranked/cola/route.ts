// src/app/api/ranked/cola/route.ts
//
// La cola de emparejamiento de Grid Ranked (Fase 9, modo competitivo).
//
// POST   -> entra en cola (o refresca su fila si ya estaba). Intenta
//           emparejar de inmediato antes de devolver la respuesta.
// GET    -> poll -- intenta emparejar de nuevo (por si apareció alguien
//           compatible desde la última vez) y devuelve el estado actual.
// DELETE -> cancela la búsqueda.
//
// Toda la lógica de verdad vive en src/lib/ranked.ts -- esta ruta solo
// resuelve el usuario con sesión y traduce a HTTP.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { entrarEnCola, salirDeCola, intentarEmparejar } from "@/lib/ranked";

export const dynamic = "force-dynamic";

async function usuarioActual() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function POST() {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const datosUsuario = await prisma.user.findUnique({ where: { id: user.id }, select: { trofeos: true } });
  if (!datosUsuario) {
    return NextResponse.json({ error: "Usuario no encontrado." }, { status: 404 });
  }

  const resultado = await entrarEnCola(user.id, datosUsuario.trofeos);
  return NextResponse.json(resultado);
}

export async function GET() {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const resultado = await intentarEmparejar(user.id);
  return NextResponse.json(resultado);
}

export async function DELETE() {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  await salirDeCola(user.id);
  return NextResponse.json({ ok: true });
}
