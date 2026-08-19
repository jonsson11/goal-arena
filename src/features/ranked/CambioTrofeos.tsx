"use client";

// src/features/ranked/CambioTrofeos.tsx
//
// Cartel de "cuánto han cambiado mis trofeos" para el resultado de una
// partida de Grid Ranked (Fase 5, 19/08/2026, pedido explícito del
// usuario: "que se vea el +N/-N, de manera bonita y espectacular").
// Mismo criterio visual que ExperienciaGanada.tsx (mini-panel de cristal,
// secuencia con setTimeout, destello si pasa algo gordo) para que el
// cartel de resultado de una partida ranked se sienta de la misma familia
// que el de una partida normal, no como un añadido aparte.
//
// Secuencia (si no hay cambio de liga, es más corta):
//   1. Aparece el marcador "antes" (trofeos con los que empezaste).
//   2. La cuenta sube/baja animada hasta el total "después".
//   3. Aparece el chip flotante +N/-N.
//   4. Si la liga cambió (subiste o bajaste de división), destello con el
//      nuevo escudo -- mismo lenguaje que el destello de "subiste de
//      nivel" del EXP, para que la app hable siempre el mismo idioma.

import { useEffect, useRef, useState } from "react";
import { ligaPorTrofeos } from "@/lib/trofeos";
import { EscudoLiga } from "./EscudoLiga";

const ESPERA_INICIAL = 400;
const DURACION_CUENTA = 900; // ms que tarda el contador en recorrer antes -> después
const ESPERA_CHIP = ESPERA_INICIAL + DURACION_CUENTA + 100;
const ESPERA_DESTELLO_LIGA = ESPERA_CHIP + 500;
const ESPERA_FIN_DESTELLO = ESPERA_DESTELLO_LIGA + 2200;

// Facilita fuera-dentro (ease-out) manual para el contador -- no usamos
// una librería de animación solo por este número, un requestAnimationFrame
// con easing a mano es más que suficiente y no añade dependencias.
function facilitarSalida(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

export function CambioTrofeos({
  cambio,
  trofeosAntes,
  trofeosDespues,
}: {
  cambio: number | null;
  trofeosAntes: number | null;
  trofeosDespues: number | null;
}) {
  const [trofeosMostrados, setTrofeosMostrados] = useState(trofeosAntes ?? 0);
  const [mostrarChip, setMostrarChip] = useState(false);
  const [destelloLiga, setDestelloLiga] = useState(false);
  const frameRef = useRef<number | null>(null);

  const ligaAntes = trofeosAntes !== null ? ligaPorTrofeos(trofeosAntes) : null;
  const ligaDespues = trofeosDespues !== null ? ligaPorTrofeos(trofeosDespues) : null;
  const cambioDeLiga = ligaAntes !== null && ligaDespues !== null && ligaAntes.id !== ligaDespues.id;
  const subioDeLiga = cambioDeLiga && ligaDespues !== null && ligaAntes !== null && ligaDespues.galones > ligaAntes.galones;

  useEffect(() => {
    if (cambio === null || trofeosAntes === null || trofeosDespues === null) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicia la secuencia de animación cuando llegan datos nuevos, mismo patrón que ExperienciaGanada.tsx
    setTrofeosMostrados(trofeosAntes);
    setMostrarChip(false);
    setDestelloLiga(false);

    const temporizadores: ReturnType<typeof setTimeout>[] = [];
    const en = (ms: number, fn: () => void) => temporizadores.push(setTimeout(fn, ms));

    en(ESPERA_INICIAL, () => {
      const inicio = performance.now();
      const paso = (ahora: number) => {
        const t = Math.min(1, (ahora - inicio) / DURACION_CUENTA);
        const valor = Math.round(trofeosAntes + (trofeosDespues - trofeosAntes) * facilitarSalida(t));
        setTrofeosMostrados(valor);
        if (t < 1) {
          frameRef.current = requestAnimationFrame(paso);
        } else {
          setTrofeosMostrados(trofeosDespues);
        }
      };
      frameRef.current = requestAnimationFrame(paso);
    });

    en(ESPERA_CHIP, () => setMostrarChip(true));

    if (cambioDeLiga) {
      en(ESPERA_DESTELLO_LIGA, () => setDestelloLiga(true));
      en(ESPERA_FIN_DESTELLO, () => setDestelloLiga(false));
    }

    return () => {
      temporizadores.forEach(clearTimeout);
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo debe reiniciar la secuencia cuando cambian los datos de verdad, no en cada render
  }, [cambio, trofeosAntes, trofeosDespues]);

  if (cambio === null || trofeosAntes === null || trofeosDespues === null || !ligaDespues) return null;

  const esPositivo = cambio >= 0;

  return (
    <div className="launcher-entrada relative z-10 flex w-full flex-col items-center gap-3 overflow-hidden rounded-xl border border-[var(--gold)]/30 bg-background/40 p-4">
      {/* Destello de cambio de liga -- mismo patrón que el destello de
          subida de nivel de ExperienciaGanada.tsx (overlay, no empuja
          layout). Sirve tanto para subir como para bajar de división. */}
      {destelloLiga && ligaDespues && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-2 rounded-xl bg-background/90 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300"
        >
          <EscudoLiga liga={ligaDespues} tamano={64} />
          <p
            className="text-shimmer bg-clip-text text-lg font-extrabold tracking-tight text-transparent"
            style={{
              backgroundImage: subioDeLiga
                ? "linear-gradient(90deg, var(--gold), #ffffff, var(--gold))"
                : "linear-gradient(90deg, var(--destructive), #ffffff, var(--destructive))",
            }}
          >
            {subioDeLiga ? `¡Subes a ${ligaDespues.nombre}!` : `Bajas a ${ligaDespues.nombre}`}
          </p>
        </div>
      )}

      <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Cambio de trofeos</p>

      <div className="flex items-center gap-3">
        <EscudoLiga liga={ligaAntes ?? ligaDespues} tamano={40} />
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-extrabold tabular-nums text-foreground">
            {trofeosMostrados.toLocaleString("es-ES")}
          </span>
          <span className="text-sm text-muted-foreground">🏆</span>
        </div>
      </div>

      {/* Chip +N/-N, entra con un pequeño rebote -- el detalle
          "espectacular" que pedía el usuario, sin pasarnos de la raya con
          una animación más larga que la propia cuenta de arriba. */}
      <span
        className={`rounded-full px-4 py-1.5 text-lg font-extrabold shadow-lg transition-all duration-500 ${
          mostrarChip ? "translate-y-0 scale-100 opacity-100" : "translate-y-2 scale-75 opacity-0"
        } ${
          esPositivo
            ? "bg-primary/15 text-primary shadow-[0_0_18px_-4px_rgba(74,222,154,0.7)]"
            : "bg-destructive/15 text-destructive shadow-[0_0_18px_-4px_rgba(224,82,79,0.6)]"
        }`}
      >
        {esPositivo ? "+" : ""}
        {cambio} 🏆
      </span>
    </div>
  );
}
