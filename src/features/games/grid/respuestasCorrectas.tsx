// src/features/games/grid/respuestasCorrectas.tsx
//
// Lógica y UI de "mostrar respuestas correctas" del Grid, compartida entre
// el modo individual (GridBoard.tsx) y el modo online (partida de
// multijugador) -- estaba duplicada solo en GridBoard.tsx; se extrae aquí
// tal cual (mismo comportamiento, mismos textos) para que ambos modos usen
// exactamente el mismo endpoint/formato en vez de mantener dos copias.

import { CircleCheck } from "lucide-react";
import type { Tablero, Celda } from "./type";

export type ResultadoCelda = { total: number; nombres: string[]; truncado: boolean };

export async function contarSolucionesTodasLasCeldas(tablero: Tablero): Promise<Record<string, ResultadoCelda>> {
  const celdas = tablero.condicionesFila.flatMap((condicionFila, fila) =>
    tablero.condicionesColumna.map((condicionColumna, columna) => ({
      fila,
      columna,
      condicionFila,
      condicionColumna,
    }))
  );

  const res = await fetch("/api/tablero/contar-soluciones", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      celdas: celdas.map((c) => ({ condicionFila: c.condicionFila, condicionColumna: c.condicionColumna })),
    }),
  });

  if (!res.ok) return {};

  const { resultados } = (await res.json()) as { resultados: ResultadoCelda[] };
  const mapa: Record<string, ResultadoCelda> = {};
  celdas.forEach((c, i) => {
    if (resultados[i]) mapa[`${c.fila}-${c.columna}`] = resultados[i];
  });
  return mapa;
}

// Para cada jugador ya colocado en el tablero, en qué casilla ("fila-col")
// se colocó -- lo usa ListaNombresCelda para saber, al listar las
// soluciones de UNA casilla, si un nombre de esa lista es justo el que
// colocó el usuario ahí (acierto, verde), si lo colocó en OTRA casilla
// (ya "gastado", rojo tachado), o si no lo ha usado en ninguna (neutro).
function construirMapaUsoPorNombre(tablero: Tablero): Map<string, string> {
  const mapa = new Map<string, string>();
  for (const celda of tablero.celdas) {
    if (celda.jugador) mapa.set(celda.jugador.nombre, `${celda.fila}-${celda.columna}`);
  }
  return mapa;
}

function obtenerCeldaEstatica(tablero: Tablero, fila: number, columna: number): Celda | undefined {
  return tablero.celdas.find((c) => c.fila === fila && c.columna === columna);
}

// Lista de nombres de una casilla, coloreada según dónde (si acaso) usó el
// usuario cada nombre. El propio acierto de esta casilla (`nombrePropio`)
// se antepone a mano si no aparece en `celda.nombres` -- puede faltar
// porque el servidor trunca la lista a LIMITE_NOMBRES (ver
// indiceEquipos.server.ts), y el acierto del jugador tiene que verse
// siempre, aunque quede fuera del orden alfabético normal.
function ListaNombresCelda({
  celda,
  claveCelda,
  nombrePropio,
  usoPorNombre,
}: {
  celda: ResultadoCelda;
  claveCelda: string;
  nombrePropio: string | null;
  usoPorNombre: Map<string, string>;
}) {
  if (celda.nombres.length === 0) {
    return <p className="text-muted-foreground">Sin soluciones registradas.</p>;
  }

  const nombres =
    nombrePropio && !celda.nombres.includes(nombrePropio) ? [nombrePropio, ...celda.nombres] : celda.nombres;

  return (
    <p className="leading-relaxed">
      {nombres.map((nombre, i) => {
        const claveDondeSeUso = usoPorNombre.get(nombre);
        const acertadoAqui = claveDondeSeUso === claveCelda;
        const usadoEnOtra = claveDondeSeUso !== undefined && !acertadoAqui;

        return (
          <span
            key={nombre}
            className={
              acertadoAqui
                ? "font-semibold text-primary"
                : usadoEnOtra
                  ? "text-destructive line-through decoration-2"
                  : "text-muted-foreground"
            }
          >
            {nombre}
            {i < nombres.length - 1 ? ", " : ""}
          </span>
        );
      })}
      {celda.truncado ? "…" : ""}
    </p>
  );
}

// Texto (no popup) con las respuestas correctas de las 9 casillas, para
// desplegar dentro del propio cartel de resultado (modo individual) o del
// panel de resultado (modo online). Reusa el mismo endpoint/formato que
// antes alimentaba el popup de soluciones por casilla en modo debug. Se
// muestran las 9 siempre -- también tras completar el tablero, para poder
// ver en verde lo acertado y en rojo tachado lo que se usó en otra casilla.
export function TextoRespuestasCorrectas({
  tablero,
  datos,
  cargando,
}: {
  tablero: Tablero;
  datos: Record<string, ResultadoCelda> | null;
  cargando: boolean;
}) {
  if (cargando || !datos) {
    return <p className="text-sm text-muted-foreground">Cargando respuestas...</p>;
  }

  const usoPorNombre = construirMapaUsoPorNombre(tablero);

  return (
    <div className="w-full space-y-2 text-left">
      <p className="text-[11px] leading-snug text-muted-foreground">
        <span className="font-semibold text-primary">Verde</span>: lo que acertaste aquí ·{" "}
        <span className="font-semibold text-destructive line-through">Rojo tachado</span>: lo usaste en otra
        casilla
      </p>

      <div className="max-h-72 w-full space-y-3 overflow-y-auto rounded-lg border border-border bg-background/60 p-3">
        {tablero.condicionesFila.map((condFila, fila) => (
          <div key={fila} className="space-y-1.5">
            {[0, 1, 2].map((columna) => {
              const condColumna = tablero.condicionesColumna[columna];
              const clave = `${fila}-${columna}`;
              const celda = datos[clave];
              const celdaTablero = obtenerCeldaEstatica(tablero, fila, columna);
              const nombrePropio = celdaTablero?.jugador?.nombre ?? null;

              return (
                <div key={columna} className="text-sm">
                  <p className="flex items-center gap-1.5 font-semibold text-foreground">
                    {condFila.valor} · {condColumna.valor}
                    {nombrePropio && <CircleCheck className="h-3.5 w-3.5 shrink-0 text-primary" />}
                  </p>
                  {celda ? (
                    <ListaNombresCelda
                      celda={celda}
                      claveCelda={clave}
                      nombrePropio={nombrePropio}
                      usoPorNombre={usoPorNombre}
                    />
                  ) : (
                    <p className="text-muted-foreground">Sin datos.</p>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
