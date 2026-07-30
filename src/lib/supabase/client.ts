// src/lib/supabase/client.ts
//
// Cliente de Supabase para usar en componentes "use client" (navegador).
// No lo uses en Server Components/Route Handlers -- para eso está
// src/lib/supabase/server.ts, que además sabe leer/escribir las cookies
// de sesión en el servidor.

import { createBrowserClient } from "@supabase/ssr";

export function crearClienteSupabaseNavegador() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}
