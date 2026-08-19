// src/features/ranked/EscudoLiga.tsx
//
// El escudo de una liga del modo competitivo -- degradado radial (luz
// arriba-izquierda -> color base -> sombra), borde biselado con brillo
// interior, un símbolo distinto por liga, y una fila de "galones"
// (triángulos) sobre el borde superior cuyo número = el índice de la
// liga (1 a 6) -- así el rango se lee contando galones, no solo por
// color (decisión de diseño del 19/08/2026, tras feedback sobre el
// mockup). Mismo componente reutilizado en el Header, el hub y el camino
// de ligas -- un solo sitio donde el escudo puede quedar desincronizado.

import type { Liga } from "@/lib/trofeos";

function oscurecer(hex: string, factor: number): string {
  const valor = hex.replace("#", "");
  const r = parseInt(valor.slice(0, 2), 16);
  const g = parseInt(valor.slice(2, 4), 16);
  const b = parseInt(valor.slice(4, 6), 16);
  const mezcla = (c: number) => Math.round(c * (1 - factor));
  return `rgb(${mezcla(r)},${mezcla(g)},${mezcla(b)})`;
}

// Símbolo interior por liga -- va escalando en "cantidad" según el rango
// (un galón -> corona), mismo criterio que el número de galones exteriores.
function Simbolo({ liga }: { liga: Liga }) {
  const fillLuz = liga.colorLuz;
  switch (liga.id) {
    case "CANTERANO":
      return (
        <path
          d="M38 55 L50 44 L62 55"
          stroke="#0B1220"
          strokeWidth={4.5}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "AMATEUR":
      return (
        <path
          d="M36 50 L50 38 L64 50 M36 60 L50 48 L64 60"
          stroke="#0B1220"
          strokeWidth={4}
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      );
    case "SEMIPROFESIONAL":
      return (
        <>
          <circle cx={50} cy={52} r={15} fill="#0B1220" />
          <path d="M50 42l6.5 4.7-2.5 7.8h-8L43 46.7Z" fill={fillLuz} />
        </>
      );
    case "PROFESIONAL":
      return (
        <path
          d="M50 32 l6.5 13.5 15 2.2-11 10.6 2.6 15L50 66.4 36.9 73.3l2.6-15-11-10.6 15-2.2Z"
          fill="#0B1220"
        />
      );
    case "INTERNACIONAL":
      return (
        <>
          <circle cx={50} cy={52} r={17} fill="none" stroke="#0B1220" strokeWidth={3.2} />
          <ellipse cx={50} cy={52} rx={17} ry={7} fill="none" stroke="#0B1220" strokeWidth={2.4} />
          <path d="M50 35v34M33 52h34" stroke="#0B1220" strokeWidth={2.4} />
        </>
      );
    case "LEYENDA":
      return (
        <>
          <path d="M32 58 28 40 40 50 50 34 60 50 72 40 68 58Z" fill="#0B1220" strokeLinejoin="round" />
          <circle cx={50} cy={30} r={3} fill="#0B1220" />
        </>
      );
  }
}

function Galones({ liga }: { liga: Liga }) {
  const totalAncho = (liga.galones - 1) * 11;
  const puntas = Array.from({ length: liga.galones }, (_, i) => 50 - totalAncho / 2 + i * 11);
  return (
    <>
      {puntas.map((x, i) => (
        <path
          key={i}
          d={`M${x - 4} 15 L${x} 9 L${x + 4} 15Z`}
          fill={liga.colorLuz}
          stroke="#0B1220"
          strokeWidth={1}
        />
      ))}
    </>
  );
}

type Props = {
  liga: Liga;
  /** Lado del cuadrado que ocupa (el SVG es siempre 1:1). */
  tamano?: number;
  /** false para sitios muy pequeños (p. ej. la insignia mini del Header)
   * donde los galones dejarían de leerse y solo añadirían ruido. */
  conGalones?: boolean;
  className?: string;
};

export function EscudoLiga({ liga, tamano = 64, conGalones = true, className }: Props) {
  const oscuro = oscurecer(liga.color, 0.35);
  const gradId = `escudo-${liga.id}`;

  return (
    <svg
      viewBox="0 0 100 100"
      width={tamano}
      height={tamano}
      className={className}
      role="img"
      aria-label={`Escudo de la liga ${liga.nombre}`}
    >
      <defs>
        <radialGradient id={gradId} cx="32%" cy="22%" r="85%">
          <stop offset="0%" stopColor={liga.colorLuz} />
          <stop offset="55%" stopColor={liga.color} />
          <stop offset="100%" stopColor={oscuro} />
        </radialGradient>
      </defs>
      <path
        d="M50 8 L88 24 V50 C88 75 72 90 50 96 C28 90 12 75 12 50 V24 Z"
        fill={oscuro}
        transform="translate(0,2)"
      />
      <path
        d="M50 6 L88 22 V48 C88 73 72 88 50 94 C28 88 12 73 12 48 V22 Z"
        fill={`url(#${gradId})`}
        stroke="#0B1220"
        strokeWidth={2}
      />
      <path
        d="M50 10 L84 24 V47 C84 68 70 81 50 87"
        fill="none"
        stroke="rgba(255,255,255,.35)"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Simbolo liga={liga} />
      {conGalones && <Galones liga={liga} />}
    </svg>
  );
}
