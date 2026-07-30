// src/app/api/auth/register/route.ts
//
// POST { nombre, email, password } -> crea la cuenta en Supabase Auth
// (que guarda y cifra la contraseña, nosotros no la tocamos en ningún
// momento) y, si sale bien, crea la fila correspondiente en nuestra tabla
// User con el mismo id que le asignó Supabase Auth.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

/** Traduce los mensajes de error de Supabase Auth (en inglés) a algo legible. */
function traducirErrorAuth(mensaje: string): string {
  if (/already registered|already exists|user already/i.test(mensaje)) {
    return "Ya existe una cuenta con ese email.";
  }
  if (/password.*(least|short|characters|weak)/i.test(mensaje)) {
    return "La contraseña debe tener al menos 6 caracteres.";
  }
  if (/invalid email|unable to validate email/i.test(mensaje)) {
    return "Ese email no parece válido.";
  }
  return mensaje;
}

export async function POST(request: Request) {
  let body: { nombre?: string; email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const nombre = body.nombre?.trim();
  const email = body.email?.trim();
  const password = body.password;

  if (!nombre || !email || !password) {
    return NextResponse.json({ error: "Faltan datos (nombre, email o contraseña)." }, { status: 400 });
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "La contraseña debe tener al menos 6 caracteres." }, { status: 400 });
  }

  // Se comprueba ANTES de crear la cuenta en Supabase Auth -- si lo
  // hiciéramos al revés y el nombre ya estuviera cogido, nos quedaría una
  // cuenta de Auth "huérfana" sin perfil (no tenemos permiso para borrarla
  // desde aquí, necesitaría la service_role key).
  const nombreEnUso = await prisma.user.findFirst({
    where: { nombre: { equals: nombre, mode: "insensitive" } },
  });
  if (nombreEnUso) {
    return NextResponse.json({ error: "Ese nombre de usuario ya está en uso." }, { status: 400 });
  }

  const supabase = await crearClienteSupabaseServidor();
  const { data, error } = await supabase.auth.signUp({ email, password });

  if (error) {
    return NextResponse.json({ error: traducirErrorAuth(error.message) }, { status: 400 });
  }
  if (!data.user) {
    return NextResponse.json({ error: "No se pudo crear la cuenta, inténtalo de nuevo." }, { status: 400 });
  }

  try {
    await prisma.user.create({
      data: {
        id: data.user.id,
        email,
        nombre,
      },
    });
  } catch (e) {
    // La cuenta en Supabase Auth ya se creó pero no pudimos crear el perfil
    // en nuestra tabla (email duplicado en User por algún motivo raro,
    // caída de la BD, etc). Se lo decimos claro al usuario en vez de dejar
    // una cuenta "a medias" sin más explicación.
    console.error("[register] Error creando el perfil en User:", e);
    return NextResponse.json(
      {
        error:
          "La cuenta se creó pero hubo un problema guardando tu perfil. Prueba a iniciar sesión o inténtalo de nuevo en unos minutos.",
      },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
