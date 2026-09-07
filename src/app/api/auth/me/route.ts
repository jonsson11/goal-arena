// src/app/api/auth/me/route.ts
//
// GET -> { usuario: Usuario | null }. Mira si hay una sesión válida de
// Supabase Auth en las cookies de la petición y, si la hay, trae el perfil
// correspondiente de nuestra tabla User. Lo llama AuthContext al arrancar
// la app (y después de login/registro) para saber quién está conectado.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import type { Usuario } from "@/features/profile/type";

// Sin esto, Next.js puede cachear la respuesta de esta ruta (GET sin
// parámetros dinámicos en la URL) en vez de leer la fila de `User` fresca
// en cada petición -- causa real encontrada el 07/09/2026 al investigar
// "los trofeos del Header no coinciden con los de verdad": era la única
// ruta GET de autenticación/perfil del proyecto sin `force-dynamic`
// (todas las demás rutas de /api/salas, /api/ranked, etc. ya lo llevan).
// AuthContext llama a esta ruta para poblar `usuario` (incluidos
// `trofeos`/`nivel`/`xp`) al arrancar la app y cada vez que se pide un
// refresco tras terminar una partida -- una respuesta cacheada de más
// deja el Header (y cualquier otro sitio que lea `usuario` del contexto)
// mostrando datos viejos hasta que la caché expira por su cuenta.
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ usuario: null });
  }

  const perfil = await prisma.user.findUnique({ where: { id: user.id } });
  if (!perfil) {
    // Sesión válida en Supabase Auth pero sin fila en User (no debería
    // pasar en uso normal, solo si algo falló a medias en el registro).
    return NextResponse.json({ usuario: null });
  }

  const usuario: Usuario = {
    id: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    avatar: perfil.avatar,
    avatarTipo: perfil.avatarTipo === "FOTO" ? "foto" : "emoji",
    nivel: perfil.nivel,
    xpActual: perfil.xpActual,
    xpSiguienteNivel: perfil.xpSiguienteNivel,
    trofeos: perfil.trofeos,
    trofeosMaximos: perfil.trofeosMaximos,
    aroEquipado: perfil.aroEquipado,
  };

  return NextResponse.json({ usuario });
}