// src/features/games/grid/GridCasillas.tsx
//
// Piezas visuales del tablero 3x3 (casilla, cabecera de fila/columna,
// imagen del jugador, abreviado del nombre) extraídas de GridBoard.tsx
// para poder reutilizarlas tal cual en la partida multijugador sin
// duplicar la lógica de escudos/banderas/tamaño de letra que ya estaba
// bien resuelta aquí.

import type { Jugador } from "@/features/games/shared/types";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import type { Celda, Condicion } from "./type";

// Foto del jugador de fondo, ocupando todo el cuadrado -- position
// absolute en vez de flex-1, para no depender de que el navegador
// combine bien "aspect-ratio" con un hijo flex que reparte el alto (esa
// mezcla puede colapsar a 0 en algunos casos).
export function ImagenJugador({ jugador }: { jugador: Jugador }) {
  const club = jugador.equipos[jugador.equipos.length - 1];
  const codigoPais = obtenerCodigoPais(jugador.nacionalidad);

  return (
    <div className="absolute inset-0 flex items-center justify-center bg-secondary">
      {jugador.imagenUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={jugador.imagenUrl} alt="" className="h-full w-full object-cover object-top" />
      ) : club?.escudo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={club.escudo} alt="" className="h-2/3 w-2/3 object-contain" />
      ) : codigoPais ? (
        <span className={`fi fi-${codigoPais} text-4xl sm:text-5xl`} />
      ) : (
        <span className="text-3xl font-bold text-secondary-foreground sm:text-4xl">
          {jugador.nombre[0]}
        </span>
      )}
    </div>
  );
}

// Partículas habituales de apellidos compuestos -- si el nombre no cabe
// entero y hay que quedarse solo con el apellido, estas palabras se
// mantienen pegadas a él en vez de perderse ("De Bruyne", no "Bruyne").
const PARTICULAS_APELLIDO = new Set([
  "de", "del", "van", "von", "der", "den", "du", "la", "le", "dos", "das", "do", "da", "di", "al",
]);

// Si el nombre completo es corto, se muestra entero. Si no, se queda
// solo con el apellido (con su partícula, si tiene) -- casi siempre
// entra en una línea, incluso con la letra más grande. El `truncate`
// del render es la red de seguridad final para el apellido larguísimo
// que aun así no quepa.
export function nombreParaCasilla(nombreCompleto: string): string {
  const palabras = nombreCompleto.trim().split(/\s+/);
  if (palabras.length === 1) return nombreCompleto;

  let inicio = palabras.length - 1;
  while (inicio > 0 && PARTICULAS_APELLIDO.has(palabras[inicio - 1].toLowerCase())) {
    inicio--;
  }

  return palabras.slice(inicio).join(" ");
}

// Cabecera de fila/columna: escudo del equipo o bandera de la selección
// encima del nombre, en vez de solo texto. Si el equipo todavía no tiene
// escudo guardado (ver scripts/equipos/sync-escudos-equipos.ts), cae al texto
// solo, igual que antes.
export function EncabezadoCondicion({ condicion }: { condicion: Condicion }) {
  const codigoPais = condicion.tipo === "nacionalidad" ? obtenerCodigoPais(condicion.valor) : null;
  const texto = condicion.valor;

  return (
    <div className="isolate flex flex-col items-center justify-center gap-1 px-1 text-center [container-type:inline-size]">
      {condicion.tipo === "equipo" && condicion.escudo ? (
        // Tamaño calibrado a ojo para que pese visualmente parecido a la
        // bandera de abajo (las banderas son más anchas que altas por
        // naturaleza, los escudos casi cuadrados -- no van a medir
        // exactamente lo mismo, pero con esto no se nota descompensado).
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={condicion.escudo}
          alt=""
          className="h-9 w-9 shrink-0 object-contain mix-blend-multiply sm:h-11 sm:w-11"
        />
      ) : codigoPais ? (
        <span className={`fi fi-${codigoPais} shrink-0 text-3xl sm:text-4xl`} />
      ) : null}
      {/* clamp() ligado al ancho del contenedor ([container-type:inline-size]
          en el div de arriba): el texto se encoge solo si no cabe. El
          truncate es la red de seguridad final, igual que en
          nombreParaCasilla. */}
      <p className="min-w-0 max-w-full truncate text-[clamp(0.6rem,9cqw,0.85rem)] font-semibold text-foreground">
        {texto}
      </p>
    </div>
  );
}

export function CasillaGrid({
  celda,
  esPendiente,
  bloqueada,
  onClick,
}: {
  celda: Celda;
  esPendiente: boolean;
  bloqueada: boolean;
  onClick: () => void;
}) {
  if (celda.jugador) {
    return (
      <div className="relative aspect-square w-full animate-in overflow-hidden rounded-xl border-2 border-primary shadow-[0_0_24px_-4px_rgba(74,222,154,0.5)] duration-300 fade-in zoom-in-90 [container-type:inline-size]">
        <ImagenJugador jugador={celda.jugador} />
        <div className="absolute inset-x-0 bottom-0 flex items-center justify-center bg-primary px-1.5 py-1">
          <p className="min-w-0 max-w-full truncate text-center font-extrabold uppercase text-primary-foreground text-[clamp(0.55rem,7.5cqw,0.9rem)]">
            {nombreParaCasilla(celda.jugador.nombre)}
          </p>
        </div>
      </div>
    );
  }

  return (
    <button
      disabled={bloqueada}
      onClick={onClick}
      // touch-manipulation + select-none: mismo motivo que en GameButton --
      // sin esto, el retraso táctil por defecto del navegador (esperando a
      // ver si es un doble-tap de zoom) es justo lo que hacía sentir la
      // selección de casilla "rarita" en móvil, sobre todo con el dedo
      // haciendo un mínimo movimiento mientras tocas una casilla pequeña.
      className={`aspect-square w-full touch-manipulation select-none rounded-xl border transition-all duration-150
        ${
          esPendiente
            ? "animate-pulse border-primary bg-primary/15"
            : "border-border bg-card hover:border-primary/40 disabled:hover:border-border"
        }
        ${bloqueada && !esPendiente ? "opacity-40" : ""}
      `}
    />
  );
}