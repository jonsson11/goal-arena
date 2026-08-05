"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
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

// Mitad de la duración total del giro (250ms de ida + 250ms de vuelta =
// 500ms, la misma duración que tenía el flip 3D anterior).
const MEDIA_DURACION_MS = 250;

export function JuegoCromo({ juego, icono }: { juego: JuegoSinIcono; icono: ReactNode }) {
  const [girado, setGirado] = useState(false);
  // "de canto": la tarjeta está contraída a scaleX(0), en el instante
  // exacto en el que se cambia qué cara se muestra. No es un flip 3D real
  // (rotateY + backface-visibility) porque esa combinación resultó poco
  // fiable en algunos navegadores móviles -- incluso con los dos prefijos
  // y con visibility:hidden de refuerzo, a MITAD del giro seguían viéndose
  // las dos caras superpuestas. scaleX no depende de nada de eso: la
  // tarjeta se encoge hasta 0 de ancho (momento en el que, al no tener
  // ancho, da igual qué contenido lleve dentro), se cambia el contenido
  // ahí mismo, y se vuelve a expandir. El resultado se lee igual de bien
  // como "giro de cromo" y funciona en el 100% de los navegadores.
  const [deCanto, setDeCanto] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  function alternar() {
    // Si ya está a mitad de giro, ignora el toque -- evita que dos toques
    // rápidos dejen el setTimeout pendiente en un estado incoherente.
    if (timeoutRef.current) return;

    // Respeta "reducir movimiento" del sistema: cambia la cara al instante,
    // sin la animación de encogerse/expandirse (mismo criterio que ya se
    // usa en globals.css para el resto de animaciones de la app).
    if (typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setGirado((g) => !g);
      return;
    }

    setDeCanto(true);
    timeoutRef.current = setTimeout(() => {
      setGirado((g) => !g);
      setDeCanto(false);
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
      }, MEDIA_DURACION_MS);
    }, MEDIA_DURACION_MS);
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={alternar}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          alternar();
        }
      }}
      // touch-manipulation: se salta el retraso táctil de doble-tap-zoom
      // del navegador, que es lo que hacía falta tocar varias veces (y a
      // veces mover el dedo) para que la tarjeta girara en móvil.
      className={`h-[300px] touch-manipulation cursor-pointer rounded-[26px] p-1.5 transition-shadow duration-300 ${
        girado ? HALO_ACTIVO_POR_ACENTO[juego.acento] : HALO_POR_ACENTO[juego.acento]
      }`}
    >
      <div
        className="relative h-full w-full transition-transform ease-in-out"
        style={{ transform: `scaleX(${deCanto ? 0 : 1})`, transitionDuration: `${MEDIA_DURACION_MS}ms` }}
      >
        {!girado ? (
          // Cara frontal
          <div className="cromo-brillo absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[22px] border border-border bg-gradient-to-br from-card to-background p-5 text-center">
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
        ) : (
          // Cara trasera
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center gap-2.5 rounded-[22px] border border-border bg-gradient-to-br p-5 text-center ${DEGRADADO_FONDO_POR_ACENTO[juego.acento]}`}
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
        )}
      </div>
    </div>
  );
}