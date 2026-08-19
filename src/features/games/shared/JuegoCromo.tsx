// src/features/games/shared/JuegoCromo.tsx
//
// Tarjeta de cada minijuego en /jugar. Rediseño "lomo de color con
// imagen" (Fase 10, 19/08/2026): hasta ahora era una tarjeta de cristal
// tintado con el icono centrado (y antes de eso, una carta que giraba --
// ver historial más abajo). Ahora lleva la captura real del juego como
// cabecera (las mismas imágenes que ya usa GameLauncher.tsx, vía
// `JuegoInfo.imagen`), recortada desde arriba y fundida con el color de
// acento del juego, con el icono como insignia pequeña sobre la foto en
// vez de protagonista único -- así la tarjeta se ve más corta y mejor
// proporcionada que si el icono ocupara todo el ancho como antes.
//
// Mismo lenguaje visual y mismo borde (BORDE_TARJETA_SOLIDA_POR_ACENTO)
// que TarjetaLomo.tsx (usado en /multijugador y /multijugador/amigos),
// pero con imagen en vez de franja de icono, porque aquí sí hay una foto
// real de cada juego a la que recurrir.
//
// Historial: hasta el 06/08/2026 era una carta que giraba (flip 3D,
// luego un scaleX cuando el 3D dio problemas en móvil) para revelar la
// descripción antes de entrar al juego. Se simplificó a una tarjeta
// estática porque el usuario las prefería así, sin animación de por
// medio -- eso se mantiene aquí, el rediseño solo cambia el aspecto, no
// vuelve a meter animación de giro.

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import type { JuegoInfo } from "./juegos";
import { COLOR_HEX_POR_ACENTO, BORDE_TARJETA_SOLIDA_POR_ACENTO } from "./acento";

// El componente de icono (`Icono`) de JuegoInfo es una función, y las
// funciones no se pueden pasar de un Server Component a uno "use client"
// (solo datos serializables o elementos ya renderizados) -- por eso este
// componente sigue recibiendo el icono YA RENDERIZADO por quien lo usa
// (jugar/page.tsx), en vez de `juego.Icono` directamente.
type JuegoSinIcono = Omit<JuegoInfo, "Icono">;

const ETIQUETA_ESTILO: Record<NonNullable<JuegoInfo["etiqueta"]>, string> = {
  DISPONIBLE: "border-destructive/60 bg-[#0B1220]/60 text-destructive",
  BETA: "border-muted-foreground/50 bg-[#0B1220]/60 text-muted-foreground",
  NEW: "border-primary/60 bg-[#0B1220]/60 text-primary",
};

export function JuegoCromo({ juego, icono }: { juego: JuegoSinIcono; icono: ReactNode }) {
  const hex = COLOR_HEX_POR_ACENTO[juego.acento];

  return (
    <Link
      href={juego.href}
      className={`group relative flex flex-col overflow-hidden rounded-2xl border bg-card backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${BORDE_TARJETA_SOLIDA_POR_ACENTO[juego.acento]}`}
    >
      <div className="relative aspect-[15/8] w-full overflow-hidden">
        {juego.imagen ? (
          <Image
            src={juego.imagen}
            alt={juego.nombre}
            fill
            className="object-cover object-top"
            sizes="(min-width: 1024px) 360px, 90vw"
          />
        ) : (
          // Sin captura todavía -- degradado con el color de marca del
          // juego en vez de romper el diseño (mismo espíritu que el
          // fallback de GameLauncher.tsx cuando no hay `imagen`).
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `linear-gradient(160deg, color-mix(in srgb, ${hex} 55%, #0B1220) 0%, #0B1220 100%)` }}
          />
        )}

        {/* Funde la foto con el fondo de la tarjeta (abajo) y con el color
            de acento (arriba), para que no se note el corte entre imagen
            y cuerpo de texto. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background: `linear-gradient(0deg, var(--card) 0%, transparent 55%), linear-gradient(180deg, color-mix(in srgb, ${hex} 32%, transparent) 0%, transparent 45%)`,
          }}
        />

        {juego.etiqueta && (
          <span
            className={`absolute right-2.5 top-2.5 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider backdrop-blur-sm ${ETIQUETA_ESTILO[juego.etiqueta]}`}
          >
            {juego.etiqueta}
          </span>
        )}

        <span
          className="absolute bottom-2.5 left-3 flex h-8 w-8 items-center justify-center rounded-[9px] text-[#0B1220] shadow-[0_4px_14px_-3px_rgba(0,0,0,0.5)]"
          style={{ background: hex }}
        >
          {icono}
        </span>
      </div>

      <div className="flex flex-1 flex-col gap-1 p-4">
        <span className="text-[10px] font-extrabold uppercase tracking-wide" style={{ color: hex }}>
          {juego.categoria}
        </span>
        <h3 className="text-base font-extrabold text-foreground">{juego.nombre}</h3>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{juego.descripcion}</p>
      </div>
    </Link>
  );
}
