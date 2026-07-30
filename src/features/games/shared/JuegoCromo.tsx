"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { JuegoInfo } from "./juegos";

// El componente de icono (`Icono`) de JuegoInfo es una función, y las
// funciones no se pueden pasar de un Server Component a uno "use client"
// (solo datos serializables o elementos ya renderizados). Por eso aquí se
// recibe SOLO el resto de datos (sin Icono) más el icono YA RENDERIZADO
// como elemento -- quien renderiza <Icono .../> es jugar/page.tsx, que sí
// es un Server Component y puede importar y usar el componente libremente.
type JuegoSinIcono = Omit<JuegoInfo, "Icono">;

const HALO_POR_ACENTO: Record<JuegoInfo["acento"], string> = {
  primary:
    "shadow-[0_0_34px_-6px_rgba(74,222,154,0.35),0_0_0_1px_rgba(74,222,154,0.08)] hover:shadow-[0_0_55px_-4px_rgba(74,222,154,0.65),0_0_0_1px_rgba(74,222,154,0.25)]",
  secondary:
    "shadow-[0_0_34px_-6px_rgba(29,122,156,0.45),0_0_0_1px_rgba(29,122,156,0.10)] hover:shadow-[0_0_55px_-4px_rgba(29,122,156,0.75),0_0_0_1px_rgba(29,122,156,0.3)]",
};

// Cuando la carta está girada, se usa SOLO este set de clases (en vez de
// combinarlo con HALO_POR_ACENTO) para no tener dos utilidades de
// box-shadow distintas compitiendo por la misma propiedad a la vez -- con
// Tailwind eso depende del orden en que genera el CSS, no del orden en el
// className, así que es mejor evitarlo directamente.
const HALO_ACTIVO_POR_ACENTO: Record<JuegoInfo["acento"], string> = {
  primary: "shadow-[0_0_55px_-4px_rgba(74,222,154,0.65),0_0_0_1px_rgba(74,222,154,0.25)]",
  secondary: "shadow-[0_0_55px_-4px_rgba(29,122,156,0.75),0_0_0_1px_rgba(29,122,156,0.3)]",
};

const ICONO_FONDO_POR_ACENTO: Record<JuegoInfo["acento"], string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/15 text-secondary",
};

const ETIQUETA_ESTILO: Record<NonNullable<JuegoInfo["etiqueta"]>, string> = {
  HOT: "border-destructive text-destructive",
  BETA: "border-muted-foreground text-muted-foreground",
  NEW: "border-primary text-primary",
};

export function JuegoCromo({ juego, icono }: { juego: JuegoSinIcono; icono: ReactNode }) {
  const [girado, setGirado] = useState(false);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => setGirado((g) => !g)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setGirado((g) => !g);
        }
      }}
      className={`h-[300px] cursor-pointer rounded-[26px] p-1.5 transition-shadow duration-300 [perspective:1200px] ${
        girado ? HALO_ACTIVO_POR_ACENTO[juego.acento] : HALO_POR_ACENTO[juego.acento]
      }`}
    >
      <div
        className={`relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] ${
          girado ? "[transform:rotateY(180deg)]" : ""
        }`}
      >
        {/* Cara frontal */}
        <div className="cromo-brillo absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[22px] border border-border bg-gradient-to-br from-card to-background p-5 text-center [backface-visibility:hidden]">
          {juego.etiqueta && (
            <span
              className={`absolute left-3.5 top-3.5 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${ETIQUETA_ESTILO[juego.etiqueta]}`}
            >
              {juego.etiqueta}
            </span>
          )}
          <div className={`z-10 flex h-16 w-16 items-center justify-center rounded-2xl ${ICONO_FONDO_POR_ACENTO[juego.acento]}`}>
            {icono}
          </div>
          <span className="z-10 text-lg font-extrabold text-foreground">{juego.nombre}</span>
          <span className="z-10 text-[11px] text-muted-foreground">Toca para ver más</span>
        </div>

        {/* Cara trasera */}
        <div className="absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center gap-2.5 rounded-[22px] border border-border bg-gradient-to-br from-primary/10 to-card p-5 text-center [backface-visibility:hidden]">
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${ICONO_FONDO_POR_ACENTO[juego.acento]}`}>
            {icono}
          </div>
          <span className="text-lg font-extrabold text-foreground">{juego.nombre}</span>
          <span className="text-[13px] leading-relaxed text-muted-foreground">{juego.descripcion}</span>
          <Link
            href={juego.href}
            onClick={(e) => e.stopPropagation()}
            className="mt-1 rounded-full bg-primary px-5 py-2 text-xs font-extrabold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Jugar ▸
          </Link>
        </div>
      </div>
    </div>
  );
}