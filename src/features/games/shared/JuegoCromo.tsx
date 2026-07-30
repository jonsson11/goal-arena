"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import type { JuegoInfo } from "./juegos";
import {
  HALO_POR_ACENTO,
  HALO_ACTIVO_POR_ACENTO,
  ICONO_FONDO_POR_ACENTO,
  TEXTO_POR_ACENTO,
  DEGRADADO_FONDO_POR_ACENTO,
} from "./acento";

// El componente de icono (`Icono`) de JuegoInfo es una función, y las
// funciones no se pueden pasar de un Server Component a uno "use client"
// (solo datos serializables o elementos ya renderizados). Por eso aquí se
// recibe SOLO el resto de datos (sin Icono) más el icono YA RENDERIZADO
// como elemento -- quien renderiza <Icono .../> es jugar/page.tsx, que sí
// es un Server Component y puede importar y usar el componente libremente.
type JuegoSinIcono = Omit<JuegoInfo, "Icono">;

const ETIQUETA_ESTILO: Record<NonNullable<JuegoInfo["etiqueta"]>, string> = {
  HOT: "border-destructive text-destructive",
  BETA: "border-muted-foreground text-muted-foreground",
  NEW: "border-primary text-primary",
};

// El mismo recurso del titular de /inicio ("Demuestra cuánto sabes de
// fútbol. En minutos." -- frase en blanco + acento en verde), aquí en dos
// líneas: kicker de color arriba, nombre en blanco grande con un resplandor
// verde debajo, en vez de partir cada nombre de juego en dos colores.
const GLOW_NOMBRE = { textShadow: "0 0 18px rgba(74,222,154,0.45)" };

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
          <span className={`z-10 text-[10px] font-bold uppercase tracking-widest ${TEXTO_POR_ACENTO[juego.acento]}`}>
            {juego.categoria}
          </span>
          <span className="z-10 text-xl font-extrabold tracking-tight text-foreground" style={GLOW_NOMBRE}>
            {juego.nombre}
          </span>
          <span className="z-10 text-[11px] text-muted-foreground">Toca para ver más</span>
        </div>

        {/* Cara trasera */}
        <div
          className={`absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center gap-2.5 rounded-[22px] border border-border bg-gradient-to-br p-5 text-center [backface-visibility:hidden] ${DEGRADADO_FONDO_POR_ACENTO[juego.acento]}`}
        >
          <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${ICONO_FONDO_POR_ACENTO[juego.acento]}`}>
            {icono}
          </div>
          <span className="text-lg font-extrabold tracking-tight text-foreground" style={GLOW_NOMBRE}>
            {juego.nombre}
          </span>
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
