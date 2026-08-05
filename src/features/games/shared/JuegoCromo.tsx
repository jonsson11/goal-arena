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
      // touch-manipulation: se salta el retraso táctil de doble-tap-zoom
      // del navegador, que es lo que hacía falta tocar varias veces (y a
      // veces mover el dedo) para que la tarjeta girara en móvil.
      className={`h-[300px] touch-manipulation cursor-pointer rounded-[26px] p-1.5 transition-shadow duration-300 [perspective:1200px] ${
        girado ? HALO_ACTIVO_POR_ACENTO[juego.acento] : HALO_POR_ACENTO[juego.acento]
      }`}
    >
      <div
        className="relative h-full w-full transition-transform duration-500 [transform-style:preserve-3d] [-webkit-transform-style:preserve-3d]"
        // El giro va por `style` (no por una clase Tailwind condicional) a
        // propósito: así la tarjeta tiene SIEMPRE un rotateY explícito desde
        // el primer render (0deg en reposo), en vez de no tener transform
        // ninguno hasta el primer toque. Sin esto, en iOS (Safari/Chrome) el
        // navegador no "promociona" la tarjeta a su propia capa 3D hasta que
        // aparece la primera transformación, así que el primer giro tiene
        // que crear la capa Y animar el rotateY a la vez -- y durante ese
        // instante se ven las dos caras superpuestas "en espejo".
        style={{
          transform: `rotateY(${girado ? 180 : 0}deg)`,
          WebkitTransform: `rotateY(${girado ? 180 : 0}deg)`,
        }}
      >
        {/* Cara frontal. */}
        <div
          className={`cromo-brillo absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[22px] border border-border bg-gradient-to-br from-card to-background p-5 text-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${
            girado ? "pointer-events-none" : ""
          }`}
          // Refuerzo además del backface-visibility de arriba: en algunos
          // navegadores móviles (el de la captura del bug) esa propiedad
          // sola no basta y las dos caras se ven superpuestas a media
          // vuelta. Con visibility:hidden de verdad, la cara que no toca
          // deja de pintarse pase lo que pase con el 3D del navegador. El
          // transitionDelay es la clave: al GIRAR la tarjeta, esta cara no
          // desaparece hasta que el giro ha terminado del todo (500ms, el
          // mismo tiempo que dura el rotateY), para no cortar la animación
          // a medias; al VOLVER a mostrarse, aparece al instante (0s).
          style={{
            visibility: girado ? "hidden" : "visible",
            transitionProperty: "visibility",
            transitionDuration: "0s",
            transitionDelay: girado ? "500ms" : "0s",
          }}
        >
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
          className={`absolute inset-0 flex [transform:rotateY(180deg)] flex-col items-center justify-center gap-2.5 rounded-[22px] border border-border bg-gradient-to-br p-5 text-center [backface-visibility:hidden] [-webkit-backface-visibility:hidden] ${DEGRADADO_FONDO_POR_ACENTO[juego.acento]} ${
            girado ? "" : "pointer-events-none"
          }`}
          // Mismo refuerzo que en la cara frontal, en espejo: visible al
          // instante en cuanto se gira, oculta de verdad (no solo por
          // backface-visibility) 500ms después de volver a la cara
          // frontal -- justo cuando termina el giro de vuelta.
          style={{
            visibility: girado ? "visible" : "hidden",
            transitionProperty: "visibility",
            transitionDuration: "0s",
            transitionDelay: girado ? "0s" : "500ms",
          }}
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
            className="mt-1 touch-manipulation rounded-full bg-primary px-5 py-2 text-xs font-extrabold text-primary-foreground transition-opacity hover:opacity-90"
          >
            Jugar ▸
          </Link>
        </div>
      </div>
    </div>
  );
}