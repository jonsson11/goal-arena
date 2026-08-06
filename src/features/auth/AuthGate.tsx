"use client";

// Pantalla que se muestra en vez del contenido real de una sección
// (Social, Perfil...) cuando no hay sesión iniciada. Antes cada página
// tenía su propia versión suelta -- Perfil con un aviso de una línea y
// un botón, Social con ninguno (llegaba a lanzar fetches a /api/amigos
// sin sesión). Se centraliza aquí para que las dos compartan el mismo
// lenguaje visual que ya usa el resto de la app: tarjeta con halo que
// respira (misma animación que la captura del GameLauncher), título con
// shimmer degradado, y las dos vías de entrada (crear cuenta / entrar)
// como botones en vez de un link de texto suelto.

import Link from "next/link";
import type { ReactNode } from "react";

type AuthGateProps = {
  icono: ReactNode;
  titulo: string;
  descripcion: string;
/** A dónde volver tras loguearse o registrarse (ver useIrA.ts para el mismo patrón, parametrizado por destino). */
  redirectTras: string;
  /** Chips cortos tipo "esto es lo que te espera" -- mismo componente visual que los `stats` del GameLauncher. */
  aspectos: string[];
};

export function AuthGate({ icono, titulo, descripcion, redirectTras, aspectos }: AuthGateProps) {
  const destino = encodeURIComponent(redirectTras);

  return (
    <div className="relative flex min-h-[60vh] items-center justify-center overflow-hidden px-6 py-16">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-80 w-80 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/15 blur-3xl motion-reduce:hidden"
      />

      <div className="launcher-entrada relative z-10 flex w-full max-w-md flex-col items-center gap-5 rounded-2xl border border-primary/30 bg-card px-8 py-10 text-center shadow-[0_0_40px_-10px_rgba(74,222,154,0.4)]">
        <span
          aria-hidden
          className="launcher-halo-pulso flex h-16 w-16 items-center justify-center rounded-2xl border border-primary/40 bg-primary/10 text-3xl"
          style={{ ["--glow-color" as string]: "rgba(74, 222, 154, 0.5)" }}
        >
          {icono}
        </span>

        <h1
          className="text-shimmer bg-clip-text text-2xl font-extrabold tracking-tight text-transparent sm:text-3xl"
          style={{
            backgroundImage: "linear-gradient(90deg, #4ADE9A, #ffffff, #4ADE9A)",
            textShadow: "0 0 24px rgba(74, 222, 154, 0.35)",
          }}
        >
          {titulo}
        </h1>

        <p className="max-w-xs text-sm leading-relaxed text-muted-foreground">{descripcion}</p>

        <div className="flex flex-wrap justify-center gap-2">
          {aspectos.map((aspecto) => (
            <span
              key={aspecto}
              className="rounded-full border border-border bg-background px-3 py-1 text-xs font-medium text-muted-foreground"
            >
              {aspecto}
            </span>
          ))}
        </div>

        <div className="mt-2 flex w-full flex-col gap-3 sm:flex-row">
          <Link
            href={`/register?redirect=${destino}`}
            className="flex-1 rounded-md bg-primary px-6 py-2.5 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Crear cuenta
          </Link>
          <Link
            href={`/login?redirect=${destino}`}
            className="flex-1 rounded-md border border-primary/40 px-6 py-2.5 text-sm font-semibold text-primary transition-colors hover:bg-primary/10"
          >
            Iniciar sesión
          </Link>
        </div>
      </div>
    </div>
  );
}
