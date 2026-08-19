"use client";

// src/features/cookies/GestionarCookiesLink.tsx
//
// Pieza mínima de cliente para el footer: el resto de Footer.tsx puede
// seguir siendo un Server Component (no depende de sesión ni estado), así
// que en vez de convertir todo el footer a "use client" solo por este
// botón, se aísla aquí -- mismo patrón que ya usa el proyecto en otros
// sitios (islas de cliente pequeñas dentro de layout server).

import { useConsentimiento } from "./ConsentimientoContext";

export function GestionarCookiesLink({ className }: { className?: string }) {
  const { abrirPreferencias } = useConsentimiento();

  return (
    <button type="button" onClick={abrirPreferencias} className={className}>
      Gestionar cookies
    </button>
  );
}
