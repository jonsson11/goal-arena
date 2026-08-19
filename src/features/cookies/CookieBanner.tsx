"use client";

// src/features/cookies/CookieBanner.tsx
//
// Banner de consentimiento de cookies, fijo abajo del todo. Se muestra en
// dos casos: el usuario nunca ha decidido (estado === null), o ha pulsado
// "Gestionar cookies" desde el footer/página de cookies (preferenciasAbiertas).
// Mientras `estado` es `undefined` (todavía no se ha leído localStorage, un
// instante en la hidratación) no se pinta nada, para no hacer parpadear el
// banner en cada carga de página.
//
// Deliberadamente NO es un <Dialog> modal (no bloquea el resto de la
// pantalla ni hay overlay oscuro) -- es una barra informativa, patrón
// habitual de banners de cookies y menos intrusivo mientras alguien está
// jugando una partida.

import Link from "next/link";
import { GameButton } from "@/features/games/shared/GameButton";
import { useConsentimiento } from "./ConsentimientoContext";

export function CookieBanner() {
  const { estado, preferenciasAbiertas, aceptarTodo, rechazarNoEsenciales, cerrarPreferencias } =
    useConsentimiento();

  const visible = estado === null || preferenciasAbiertas;
  if (!visible) return null;

  return (
    <div
      role="dialog"
      aria-label="Preferencias de cookies"
      className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 px-4 py-4 shadow-[0_-8px_30px_rgba(0,0,0,0.4)] backdrop-blur-md sm:px-6"
    >
      <div className="mx-auto flex max-w-4xl flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Usamos cookies necesarias para que Goal Arena funcione (sesión, preferencias) y, si nos
          das tu consentimiento, cookies de anuncios para poder mantener la web gratuita. Puedes
          leer más en nuestra{" "}
          <Link href="/cookies" className="font-medium text-primary underline underline-offset-2">
            política de cookies
          </Link>{" "}
          o en la{" "}
          <Link href="/privacidad" className="font-medium text-primary underline underline-offset-2">
            política de privacidad
          </Link>
          .
        </p>

        <div className="flex shrink-0 gap-3">
          {preferenciasAbiertas && (
            <GameButton
              type="button"
              variant="secondary"
              className="flex-1 sm:flex-none"
              onClick={cerrarPreferencias}
            >
              Cerrar
            </GameButton>
          )}
          <GameButton
            type="button"
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={rechazarNoEsenciales}
          >
            Rechazar
          </GameButton>
          <GameButton type="button" className="flex-1 sm:flex-none" onClick={aceptarTodo}>
            Aceptar todo
          </GameButton>
        </div>
      </div>
    </div>
  );
}
