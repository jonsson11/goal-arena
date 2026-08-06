// src/features/multijugador/BotonAtras.tsx
//
// Mismo estilo visual que el botón "Atrás" de GameLauncher.tsx (que a su
// vez copia el botón "Iniciar sesión" del navbar) -- un solo estilo de
// botón "volver" reconocible en toda la app, en vez de un link de texto
// suelto como tenían antes estas pantallas ("← Multijugador"). No se
// reutiliza el de GameLauncher directamente porque ese lleva enganchada
// su animación de entrada escalonada (launcher-entrada + conRetraso),
// específica de esa pantalla.

import Link from "next/link";

export function BotonAtras({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="relative z-10 mb-8 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
    >
      <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M12.5 15L7.5 10L12.5 5"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      Atrás
    </Link>
  );
}