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

import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  // "verde": degradado primary -> secondary -> primary (usado en /jugar,
  // /social). "azul": secondary -> primary -> secondary (usado en todo
  // el multijugador). Dos nombres cortos en vez de pasar las clases de
  // Tailwind a mano en cada sitio, para que no se pueda escribir mal el
  // degradado por accidente.
  acento?: "verde" | "azul";
  className?: string;
};

const GRADIENTE_POR_ACENTO: Record<"verde" | "azul", string> = {
  verde: "from-primary via-secondary to-primary",
  azul: "from-secondary via-primary to-secondary",
};

const SOMBRA_POR_ACENTO: Record<"verde" | "azul", string> = {
  verde: "0 0 30px rgba(74,222,154,0.25)",
  azul: "0 0 30px rgba(29,122,156,0.35)",
};

export function TituloPagina({ children, acento = "verde", className = "" }: Props) {
  return (
    <h1
      className={`text-shimmer bg-gradient-to-r ${GRADIENTE_POR_ACENTO[acento]} bg-clip-text pb-1 text-4xl font-extrabold leading-[1.15] tracking-tight text-transparent sm:pb-2 sm:text-5xl ${className}`}
      style={{ textShadow: SOMBRA_POR_ACENTO[acento] }}
    >
      {children}
    </h1>
  );
}