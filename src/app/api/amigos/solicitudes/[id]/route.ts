// src/app/api/amigos/solicitudes/[id]/route.ts
//
// POST { accion: "aceptar" | "rechazar" } -> resuelve una solicitud de
// amistad recibida. Solo la puede resolver el RECEPTOR de esa solicitud
// concreta (se comprueba contra la sesión, nunca te fías del id que llega
// por la URL a secas).

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  let body: { accion?: "aceptar" | "rechazar" };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  if (body.accion !== "aceptar" && body.accion !== "rechazar") {
    return NextResponse.json({ error: "Acción inválida." }, { status: 400 });
  }

  const solicitud = await prisma.friendship.findUnique({ where: { id } });
  if (!solicitud || solicitud.receptorId !== user.id || solicitud.estado !== "PENDIENTE") {
    return NextResponse.json({ error: "Esa solicitud ya no está disponible." }, { status: 404 });
  }

  if (body.accion === "aceptar") {
    await prisma.friendship.update({
      where: { id },
      data: { estado: "ACEPTADA", respondidoEn: new Date() },
    });
  } else {
    // Rechazar borra la fila directamente (en vez de guardar un estado
    // RECHAZADA) para que, si algún día quieren volver a añadirse, no se
    // quede bloqueado por una fila vieja.
    await prisma.friendship.delete({ where: { id } });
  }

  return NextResponse.json({ ok: true });
}
