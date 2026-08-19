// src/features/games/shared/TarjetaLomo.tsx
//
// Tarjeta "lomo de color" (Fase 10, rediseño de menús, 19/08/2026):
// franja sólida de acento a la izquierda con el icono dentro, cuerpo de
// texto a la derecha. Sustituye a las tarjetas de icono centrado que
// tenían antes /multijugador/page.tsx (elección de modo: Competitivo vs
// Amigos) y /multijugador/amigos/page.tsx (Crear sala / Unirse a sala).
// Aprobada por mockup tras varias rondas de feedback del usuario (ver
// claude/diseno-modo-competitivo.md) -- misma idea que ya le convencía
// del antiguo diseño de /multijugador (fondo sólido, sin cristal
// tintado), pero con más identidad de marca vía la franja de color.
//
// Para las tarjetas de "Un jugador" (que sí tienen una foto real de cada
// juego), ver JuegoCromo.tsx -- mismo lenguaje visual, mismo borde
// (BORDE_TARJETA_SOLIDA_POR_ACENTO en acento.ts), pero con una imagen
// arriba en vez de la franja de icono a la izquierda.

import Link from "next/link";
import type { ReactNode } from "react";
import { COLOR_HEX_POR_ACENTO, BORDE_TARJETA_SOLIDA_POR_ACENTO, type Acento } from "./acento";

// Textura sutil de rayas diagonales sobre la franja de color, para que no
// se quede como un bloque de color totalmente plano -- ni depende del
// acento (es solo blanco a baja opacidad), así que no hace falta un mapa
// por color.
const TEXTURA_HATCH =
  "repeating-linear-gradient(135deg, rgba(255,255,255,0.09) 0 2px, transparent 2px 10px)";

type TarjetaLomoProps = {
  href: string;
  acento: Acento;
  icono: ReactNode;
  titulo: string;
  descripcion: string;
  /** Insignia opcional arriba a la derecha (p.ej. "RANKED"). Se recibe ya
   * renderizada por quien la usa para no atar este componente a un único
   * estilo de insignia. */
  badge?: ReactNode;
  /** Fila extra opcional debajo de la descripción (p.ej. "Tu liga actual: ..."). */
  footer?: ReactNode;
  /** Tarjeta más baja, pensada para grids de 2 columnas (Crear sala /
   * Unirse a sala) en vez de la fila ancha de la elección de modo. */
  compacta?: boolean;
};

export function TarjetaLomo({ href, acento, icono, titulo, descripcion, badge, footer, compacta }: TarjetaLomoProps) {
  const hex = COLOR_HEX_POR_ACENTO[acento];

  return (
    <Link
      href={href}
      className={`group relative flex overflow-hidden rounded-2xl border bg-card backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${
        compacta ? "min-h-[172px]" : "min-h-[136px]"
      } ${BORDE_TARJETA_SOLIDA_POR_ACENTO[acento]}`}
    >
      {badge && <div className="absolute right-3.5 top-3.5 z-[1]">{badge}</div>}

      <div
        className="relative flex w-[72px] shrink-0 items-center justify-center overflow-hidden sm:w-20"
        style={{
          background: `linear-gradient(180deg, color-mix(in srgb, ${hex} 92%, black 0%), color-mix(in srgb, ${hex} 60%, black 25%))`,
        }}
      >
        <div aria-hidden className="pointer-events-none absolute inset-0" style={{ backgroundImage: TEXTURA_HATCH }} />
        <span className="relative text-[#0B1220]">{icono}</span>
      </div>

      <div className="flex flex-1 flex-col justify-center gap-1.5 p-5">
        <h3 className="text-lg font-extrabold text-foreground">{titulo}</h3>
        <p className="text-sm leading-relaxed text-muted-foreground">{descripcion}</p>
        {footer}
      </div>
    </Link>
  );
}
