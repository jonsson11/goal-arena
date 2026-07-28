// src/app/api/solicitudes/jugador/route.ts
import { NextResponse } from "next/server";
import { Resend } from "resend";

export const dynamic = "force-dynamic";

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
  try {
    const { nombre, nota, empresa } = await request.json();

    // Honeypot relleno -> probablemente un bot. Respondemos éxito falso
    // para no delatar la trampa, pero no enviamos nada.
    if (empresa) {
      return NextResponse.json({ ok: true });
    }

    if (typeof nombre !== "string" || nombre.trim().length === 0) {
      return NextResponse.json({ error: "El nombre del jugador es obligatorio." }, { status: 400 });
    }

    if (nombre.length > 120 || (nota && nota.length > 300)) {
      return NextResponse.json({ error: "El texto es demasiado largo." }, { status: 400 });
    }

    const destino = process.env.SOLICITUDES_EMAIL_DESTINO;
    if (!destino) {
      console.error("POST /api/solicitudes/jugador: falta SOLICITUDES_EMAIL_DESTINO en .env");
      return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
    }

    await resend.emails.send({
      from: "Goal Arena <onboarding@resend.dev>", // cambia esto cuando verifiques tu propio dominio en Resend
      to: destino,
      subject: `[Goal Arena] Solicitud de jugador: ${nombre}`,
      text: `Jugador solicitado: ${nombre}\n\nContexto: ${nota || "(sin contexto)"}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("POST /api/solicitudes/jugador: fallo al enviar", err);
    return NextResponse.json({ error: "No se pudo enviar la solicitud." }, { status: 500 });
  }
}