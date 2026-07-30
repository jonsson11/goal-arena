// src/app/api/amigos/[id]/route.ts
//
// DELETE -> deshace la amistad con el usuario cuyo id llega en la URL.
// El [id] aquí es el id del OTRO usuario (el amigo), no el de la fila
// Friendship -- así el botón "Eliminar amigo" en la lista no necesita
// conocer el id interno de la amistad, solo con quién es.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: amigoId } = await params;

  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const amistad = await prisma.friendship.findFirst({
    where: {
      estado: "ACEPTADA",
      OR: [
        { solicitanteId: user.id, receptorId: amigoId },
        { solicitanteId: amigoId, receptorId: user.id },
      ],
    },
  });

  if (!amistad) {
    return NextResponse.json({ error: "No sois amigos." }, { status: 404 });
  }

  await prisma.friendship.delete({ where: { id: amistad.id } });

  return NextResponse.json({ ok: true });
}