// src/lib/supabase/server.ts
//
// Cliente de Supabase para usar en el servidor (Route Handlers, Server
// Components, Server Actions). A diferencia del de client.ts, este lee y
// escribe la sesión directamente en las cookies de la petición -- así el
// navegador no necesita guardar nada en localStorage, todo va por cookie
// httpOnly que gestiona Supabase.
//
// Nota: dentro de un Server Component "de solo lectura" (no un Route
// Handler ni una Server Action) no se pueden escribir cookies, así que el
// setAll de abajo puede fallar silenciosamente ahí -- no pasa nada, el
// middleware (middleware.ts en la raíz) se encarga de refrescar la sesión
// en cada petición igualmente.

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

export async function crearClienteSupabaseServidor() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesParaGuardar) {
          try {
            cookiesParaGuardar.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Llamado desde un Server Component de solo lectura -- se ignora,
            // ver nota de arriba.
          }
        },
      },
    }
  );
}
