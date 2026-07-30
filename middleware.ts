// middleware.ts
//
// Se ejecuta en cada petición. Su único trabajo es refrescar el token de
// sesión de Supabase Auth cuando está a punto de caducar (dura ~1 hora),
// para que no se cierre la sesión sola mientras el usuario sigue navegando.
// Sin esto, la sesión "vivía" bien en el navegador pero al cabo de un rato
// las peticiones al servidor (Route Handlers, Server Components) dejarían
// de reconocer al usuario como logueado.

import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

export async function middleware(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesParaGuardar) {
          cookiesParaGuardar.forEach(({ name, value }) => request.cookies.set(name, value));
          respuesta = NextResponse.next({ request });
          cookiesParaGuardar.forEach(({ name, value, options }) =>
            respuesta.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // No usamos el resultado directamente aquí -- solo con llamarlo ya se
  // encarga de renovar el token si hace falta y de guardar las cookies
  // nuevas en `respuesta`.
  await supabase.auth.getUser();

  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos los archivos estáticos de Next y los assets con extensión
    // de imagen -- no tiene sentido gastar tiempo refrescando sesión ahí.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
