// src/features/ranked/AnilloLiga.tsx
//
// El halo de avatar del modo competitivo: un aro de color con pequeñas
// marcas repartidas alrededor (mismo conteo que los galones de
// EscudoLiga.tsx), doble/más grueso a partir de Profesional, con un
// detalle de laurel en Leyenda. Se pinta como un SVG superpuesto (position
// absolute, sin relleno en el centro) para poder colocarlo ENCIMA del
// avatar real (foto o emoji) sin tener que tocar cómo se renderiza ese
// avatar en cada sitio -- ver el uso en AccountMenu.tsx.

import type { Liga } from "@/lib/trofeos";

// Posiciones (x,y en un viewBox 0-60, centro 30,30, radio 27) de las
// marcas para cada conteo de 1 a 6 -- primera arriba (ángulo -90º), el
// resto repartidas a partes iguales alrededor del círculo.
const PUNTOS_POR_N: Record<number, Array<[number, number]>> = {
  1: [[30, 3]],
  2: [
    [30, 3],
    [30, 57],
  ],
  3: [
    [30, 3],
    [53.4, 43.5],
    [6.6, 43.5],
  ],
  4: [
    [30, 3],
    [57, 30],
    [30, 57],
    [3, 30],
  ],
  5: [
    [30, 3],
    [55.7, 21.7],
    [45.9, 51.8],
    [14.1, 51.8],
    [4.3, 21.7],
  ],
  6: [
    [30, 3],
    [53.4, 16.5],
    [53.4, 43.5],
    [30, 57],
    [6.6, 43.5],
    [6.6, 16.5],
  ],
};

type Props = {
  liga: Liga;
  /** Lado del cuadrado del avatar que envuelve -- debe coincidir con el
   * tamaño real del avatar para que el aro quede pegado a su borde. */
  tamano: number;
  className?: string;
};

/** Overlay absoluto -- el elemento padre debe tener `position: relative`
 * y contener ya el avatar real (mismo tamaño) para que el aro se pinte
 * encima de su borde, no debajo. */
export function AnilloLiga({ liga, tamano, className }: Props) {
  const doble = liga.galones >= 4; // Profesional, Internacional, Leyenda
  const puntos = PUNTOS_POR_N[liga.galones] ?? PUNTOS_POR_N[1];
  const esLeyenda = liga.id === "LEYENDA";

  return (
    <svg
      viewBox="0 0 60 60"
      width={tamano}
      height={tamano}
      className={`pointer-events-none absolute inset-0 ${className ?? ""}`}
      aria-hidden
    >
      {doble && <circle cx={30} cy={30} r={27} fill="none" stroke={liga.color} strokeWidth={2} opacity={0.45} />}
      <circle
        cx={30}
        cy={30}
        r={doble ? 23 : 24}
        fill="none"
        stroke={liga.color}
        strokeWidth={doble ? 3.5 : 2.5}
      />
      {puntos.map(([x, y], i) => (
        <circle key={i} cx={x} cy={y} r={2.6} fill={liga.colorLuz} stroke="#0B1220" strokeWidth={1} />
      ))}
      {esLeyenda && (
        <>
          <path d="M14 44c-5 4-6 10-3 15 4-2 6-6 7-10Z" fill={liga.colorLuz} opacity={0.85} />
          <path d="M46 44c5 4 6 10 3 15-4-2-6-6-7-10Z" fill={liga.colorLuz} opacity={0.85} />
        </>
      )}
    </svg>
  );
}
