// src/app/api/auth/login/route.ts
//
// POST { email, password } -> valida las credenciales contra Supabase Auth.
// Si son correctas, Supabase deja la sesión guardada en cookies httpOnly
// automáticamente (lo hace el cliente de src/lib/supabase/server.ts al
// escribir la respuesta) -- no hay que hacer nada más a mano aquí.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";

export async function POST(request: Request) {
  let body: { email?: string; password?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const email = body.email?.trim();
  const password = body.password;

  if (!email || !password) {
    return NextResponse.json({ error: "Faltan datos (email o contraseña)." }, { status: 400 });
  }

  const supabase = await crearClienteSupabaseServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    const mensaje = /invalid login credentials/i.test(error.message)
      ? "Email o contraseña incorrectos."
      : error.message;
    return NextResponse.json({ error: mensaje }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
