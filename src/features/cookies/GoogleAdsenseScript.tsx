"use client";

// src/features/cookies/GoogleAdsenseScript.tsx
//
// Carga el script de Google AdSense (adsbygoogle.js) SOLO cuando se cumplen
// las dos condiciones a la vez:
//
//   1. Hay un ID de editor configurado (NEXT_PUBLIC_ADSENSE_CLIENT_ID) --
//      mientras no exista (todavía no tenemos cuenta aprobada), este
//      componente no renderiza nada, así que es seguro dejarlo montado en
//      el layout desde ya.
//   2. El usuario ha aceptado cookies de anuncios (estado === "aceptado")
//      -- si rechaza o no ha decidido todavía, no se pide el script. Esto
//      es lo que exige la política de consentimiento de Google para
//      usuarios de la UE/Reino Unido: no servir anuncios personalizados
//      sin consentimiento previo.
//
// Cuando se apruebe la cuenta, basta con definir la variable de entorno en
// Vercel (Settings → Environment Variables) con el ID real
// (formato "ca-pub-XXXXXXXXXXXXXXXX") -- no hace falta tocar código.

import Script from "next/script";
import { useConsentimiento } from "./ConsentimientoContext";

const ADSENSE_CLIENT_ID = process.env.NEXT_PUBLIC_ADSENSE_CLIENT_ID;

export function GoogleAdsenseScript() {
  const { estado } = useConsentimiento();

  if (!ADSENSE_CLIENT_ID) return null;
  if (estado?.decision !== "aceptado") return null;

  return (
    <Script
      async
      src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT_ID}`}
      crossOrigin="anonymous"
      strategy="afterInteractive"
    />
  );
}
