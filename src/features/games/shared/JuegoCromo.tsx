// src/features/games/shared/JuegoCromo.tsx
//
// Tarjeta de cada minijuego en /jugar. Hasta el 06/08/2026 era una carta
// que giraba (primero flip 3D, luego un scaleX cuando el 3D dio problemas
// en móvil) para revelar la descripción antes de entrar al juego. Se
// simplificó a una tarjeta de cristal estática -- exactamente el mismo
// estilo que ya usan las tarjetas de /multijugador (Crear sala / Unirse a
// sala) -- porque el usuario las prefería así: sin animación de por
// medio, con toda la información ya visible, un único toque para entrar.

import Link from "next/link";
import type { ReactNode } from "react";
import type { JuegoInfo } from "./juegos";
import { TARJETA_CRISTAL_POR_ACENTO, ICONO_FONDO_POR_ACENTO } from "./acento";

// El componente de icono (`Icono`) de JuegoInfo es una función, y las
// funciones no se pueden pasar de un Server Component a uno "use client"
// (solo datos serializables o elementos ya renderizados) -- aunque este
// componente ya no necesita ser "use client" él mismo (sin estado ni
// efectos desde que se quitó el giro), se mantiene la misma forma de
// recibir el icono YA RENDERIZADO por quien lo use, para no tener que
// tocar también jugar/page.tsx.
type JuegoSinIcono = Omit<JuegoInfo, "Icono">;

const ETIQUETA_ESTILO: Record<NonNullable<JuegoInfo["etiqueta"]>, string> = {
  DISPONIBLE: "border-destructive text-destructive",
  BETA: "border-muted-foreground text-muted-foreground",
  NEW: "border-primary text-primary",
};

export function JuegoCromo({ juego, icono }: { juego: JuegoSinIcono; icono: ReactNode }) {
  return (
    <Link
      href={juego.href}
      className={`group relative flex flex-col items-center gap-3 rounded-2xl border p-8 text-center backdrop-blur-md transition-all duration-300 hover:-translate-y-1 ${TARJETA_CRISTAL_POR_ACENTO[juego.acento]}`}
    >
      {juego.etiqueta && (
        <span
          className={`absolute left-3.5 top-3.5 rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${ETIQUETA_ESTILO[juego.etiqueta]}`}
        >
          {juego.etiqueta}
        </span>
      )}
      <span className={`flex h-16 w-16 items-center justify-center rounded-2xl ${ICONO_FONDO_POR_ACENTO[juego.acento]}`}>
        {icono}
      </span>
      <span className="text-xl font-extrabold text-foreground">{juego.nombre}</span>
      <span className="text-sm text-muted-foreground">{juego.descripcion}</span>
    </Link>
  );
}