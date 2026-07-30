// src/app/api/amigos/route.ts
//
// GET  -> { amigos: Amigo[], solicitudes: SolicitudAmistad[] } del usuario
//         con sesión activa (amigos = amistades ACEPTADAS en cualquier
//         dirección; solicitudes = las que le han enviado A ÉL y siguen
//         PENDIENTES).
// POST { nombreUsuario } -> envía una solicitud de amistad a ese usuario.
//         Si ya existe una solicitud pendiente en la dirección contraria,
//         se acepta esa en vez de crear una nueva (así da igual quién de
//         los dos "pulsa antes").

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { estaConectado } from "@/lib/presencia";
import type { Amigo, SolicitudAmistad } from "@/features/social/type";

async function usuarioActual() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function GET() {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const [aceptadasEnviadas, aceptadasRecibidas, pendientesRecibidas] = await Promise.all([
    prisma.friendship.findMany({
      where: { solicitanteId: user.id, estado: "ACEPTADA" },
      include: { receptor: true },
    }),
    prisma.friendship.findMany({
      where: { receptorId: user.id, estado: "ACEPTADA" },
      include: { solicitante: true },
    }),
    prisma.friendship.findMany({
      where: { receptorId: user.id, estado: "PENDIENTE" },
      include: { solicitante: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const amigos: Amigo[] = [
    ...aceptadasEnviadas.map((f) => ({
      id: f.receptor.id,
      nombre: f.receptor.nombre,
      avatar: f.receptor.avatar,
      avatarTipo: f.receptor.avatarTipo === "FOTO" ? ("foto" as const) : ("emoji" as const),
      nivel: f.receptor.nivel,
      enLinea: estaConectado(f.receptor.ultimaActividad),
    })),
    ...aceptadasRecibidas.map((f) => ({
      id: f.solicitante.id,
      nombre: f.solicitante.nombre,
      avatar: f.solicitante.avatar,
      avatarTipo: f.solicitante.avatarTipo === "FOTO" ? ("foto" as const) : ("emoji" as const),
      nivel: f.solicitante.nivel,
      enLinea: estaConectado(f.solicitante.ultimaActividad),
    })),
  ];

  const solicitudes: SolicitudAmistad[] = pendientesRecibidas.map((f) => ({
    id: f.id,
    nombre: f.solicitante.nombre,
    avatar: f.solicitante.avatar,
    avatarTipo: f.solicitante.avatarTipo === "FOTO" ? ("foto" as const) : ("emoji" as const),
    nivel: f.solicitante.nivel,
  }));

  return NextResponse.json({ amigos, solicitudes });
}

export async function POST(request: Request) {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  let body: { nombreUsuario?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const nombreBuscado = body.nombreUsuario?.trim();
  if (!nombreBuscado) {
    return NextResponse.json({ error: "Escribe un nombre de usuario." }, { status: 400 });
  }

  const destinatario = await prisma.user.findFirst({
    where: { nombre: { equals: nombreBuscado, mode: "insensitive" } },
  });

  if (!destinatario) {
    return NextResponse.json({ error: `No existe ningún usuario "${nombreBuscado}".` }, { status: 404 });
  }
  if (destinatario.id === user.id) {
    return NextResponse.json({ error: "No puedes añadirte a ti mismo." }, { status: 400 });
  }

  // ¿Ya hay algo entre estos dos, en cualquier dirección?
  const existente = await prisma.friendship.findFirst({
    where: {
      OR: [
        { solicitanteId: user.id, receptorId: destinatario.id },
        { solicitanteId: destinatario.id, receptorId: user.id },
      ],
    },
  });

  if (existente) {
    if (existente.estado === "ACEPTADA") {
      return NextResponse.json({ error: `Ya sois amigos con ${destinatario.nombre}.` }, { status: 400 });
    }
    // Solicitud pendiente ya existente:
    if (existente.solicitanteId === user.id) {
      return NextResponse.json(
        { error: `Ya le has enviado una solicitud a ${destinatario.nombre}, está pendiente de que la acepte.` },
        { status: 400 }
      );
    }
    // El otro te la había enviado a ti antes -- se acepta directamente en
    // vez de crear una solicitud nueva en sentido contrario.
    await prisma.friendship.update({
      where: { id: existente.id },
      data: { estado: "ACEPTADA", respondidoEn: new Date() },
    });
    return NextResponse.json({ ok: true, aceptadaDirectamente: true });
  }

  await prisma.friendship.create({
    data: { solicitanteId: user.id, receptorId: destinatario.id },
  });

  return NextResponse.json({ ok: true });
}
