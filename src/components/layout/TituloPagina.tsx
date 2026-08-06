// src/components/layout/TituloPagina.tsx
//
// Título grande con degradado "brillante" (shimmer), usado en la cabecera
// de /jugar, /multijugador y sus subpáginas, y /social. Extraído a un
// componente único el 06/08/2026 porque el mismo bug se repetía en las 6
// pantallas que lo usaban por separado: `text-4xl`/`sm:text-5xl` traen de
// serie `line-height: 1` (el valor por defecto de esas utilidades de
// Tailwind), y con letras de trazo alto/bajo (como la "j" o la "g") ese
// interlineado tan justo hace que `background-clip: text` recorte el
// degradado justo en el borde de la caja de línea -- la letra no se ve
// mal dibujada, literalmente se queda sin relleno en la parte que
// sobresale. El arreglo es darle más aire vertical con `leading-[1.15]` y
// un pelín de `padding-bottom` de margen extra, para que la caja de línea
// sea más alta que el propio texto y nunca recorte nada.
//
// `hrefAtras` (mismo día) resuelve un segundo problema: el botón "Atrás"
// vivía en su propia línea ENCIMA del título, empujándolo hacia abajo y
// dejando un hueco de por medio -- con `hrefAtras`, el botón se pinta en
// la MISMA fila que el título (flotando a la izquierda, centrado
// verticalmente con él vía position:absolute), así que ya no ocupa altura
// propia y el título queda pegado arriba del todo, igual que en las
// pantallas que no tienen botón de volver (Social).

import type { ReactNode } from "react";
import { BotonAtras } from "@/features/games/shared/BotonAtras";

type Props = {
  children: ReactNode;
  // "verde": degradado primary -> secondary -> primary (usado en /jugar,
  // /social). "azul": secondary -> primary -> secondary (usado en todo
  // el multijugador). Dos nombres cortos en vez de pasar las clases de
  // Tailwind a mano en cada sitio, para que no se pueda escribir mal el
  // degradado por accidente.
  acento?: "verde" | "azul";
  className?: string;
  /** Si se indica, pinta el botón "Atrás" en la misma fila que el título,
   * flotando a la izquierda. Omítelo en pantallas sin vuelta atrás
   * (Social) o donde "volver" implica confirmación (la sala de espera
   * usa su propio botón "Salir de la sala" con ConfirmDialog en vez de
   * esto). */
  hrefAtras?: string;
};

const GRADIENTE_POR_ACENTO: Record<"verde" | "azul", string> = {
  verde: "from-primary via-secondary to-primary",
  azul: "from-secondary via-primary to-secondary",
};

const SOMBRA_POR_ACENTO: Record<"verde" | "azul", string> = {
  verde: "0 0 30px rgba(74,222,154,0.25)",
  azul: "0 0 30px rgba(29,122,156,0.35)",
};

export function TituloPagina({ children, acento = "verde", className = "", hrefAtras }: Props) {
  const titulo = (
    <h1
      className={`text-shimmer bg-gradient-to-r ${GRADIENTE_POR_ACENTO[acento]} bg-clip-text pb-1 text-4xl font-extrabold leading-[1.15] tracking-tight text-transparent sm:pb-2 sm:text-5xl ${className}`}
      style={{ textShadow: SOMBRA_POR_ACENTO[acento] }}
    >
      {children}
    </h1>
  );

  if (!hrefAtras) return titulo;

  return (
    <div className="relative flex w-full items-center justify-center">
      <BotonAtras href={hrefAtras} className="absolute left-0 top-1/2 -translate-y-1/2" />
      {titulo}
    </div>
  );
}