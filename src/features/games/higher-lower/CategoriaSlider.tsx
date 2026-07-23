"use client";

import { useEffect, useState } from "react";
import { CATEGORIAS, ETIQUETAS_CATEGORIA, type Categoria } from "./type";

const ALTURA_ITEM = 88; // px
const VUELTAS = 5;
const DURACION_MS = 3000;

function construirCarrete(categoriaGanadora: Categoria): Categoria[] {
  const carrete: Categoria[] = [];

  for (let vuelta = 0; vuelta < VUELTAS; vuelta++) {
    carrete.push(...CATEGORIAS);
  }

  carrete.push(categoriaGanadora);
  return carrete;
}

type CategoriaSliderProps = {
  categoriaGanadora: Categoria;
  onTerminar: () => void;
};

export function CategoriaSlider({ categoriaGanadora, onTerminar }: CategoriaSliderProps) {
  const [carrete] = useState(() => construirCarrete(categoriaGanadora));
  const [girando, setGirando] = useState(false);

  useEffect(() => {
    const iniciar = setTimeout(() => setGirando(true), 50);
    const terminar = setTimeout(() => onTerminar(), DURACION_MS + 100);

    return () => {
      clearTimeout(iniciar);
      clearTimeout(terminar);
    };
  }, [onTerminar]);

  const indiceFinal = carrete.length - 1;
  const desplazamiento = girando ? indiceFinal * ALTURA_ITEM : 0;

  return (
    <div className="relative mx-auto w-80">
      {/* Marcador fijo central, con halo verde detrás */}
      <div
        className="pointer-events-none absolute left-1/2 top-1/2 z-10 w-full -translate-x-1/2 -translate-y-1/2 rounded-lg border-2 border-primary/60"
        style={{
          height: ALTURA_ITEM,
          boxShadow: "0 0 30px 4px rgba(74, 222, 154, 0.35)",
        }}
      />

      {/* Ventana visible con difuminado arriba/abajo */}
      <div
        className="relative overflow-hidden rounded-lg bg-card"
        style={{
          height: ALTURA_ITEM,
          WebkitMaskImage:
            "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
          maskImage:
            "linear-gradient(to bottom, transparent, black 20%, black 80%, transparent)",
        }}
      >
        <div
          className="transition-transform ease-out"
          style={{
            transform: `translateY(-${desplazamiento}px)`,
            transitionDuration: `${DURACION_MS}ms`,
          }}
        >
          {carrete.map((categoria, i) => {
            const esLaGanadora = i === indiceFinal && girando;

            return (
              <div
                key={i}
                style={{ height: ALTURA_ITEM }}
                className={`flex items-center justify-center text-center text-2xl font-extrabold tracking-tight transition-all duration-300 ${
                  esLaGanadora
                    ? "scale-105 text-primary drop-shadow-[0_0_18px_rgba(74,222,154,0.9)]"
                    : "text-muted-foreground/50"
                }`}
              >
                {ETIQUETAS_CATEGORIA[categoria]}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}