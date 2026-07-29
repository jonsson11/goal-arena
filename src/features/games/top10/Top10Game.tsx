"use client";

import { useEffect, useRef, useState } from "react";
import type { Jugador } from "@/features/games/shared/types";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import type { EntradaTop10, RankingTop10 } from "./type";
import { buscarEntradaCoincidente } from "./logic";

function segundosTranscurridos(inicio: number): number {
  return Math.floor((Date.now() - inicio) / 1000);
}

async function buscarJugadores(query: string): Promise<Jugador[]> {
  const res = await fetch(`/api/jugadores/buscar?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Error al buscar jugadores");
  return res.json();
}

type EstiloPosicion = {
  fila: string;
  badge: string;
  nombre: string;
};

function obtenerEstiloPosicion(posicion: number, acertado: boolean): EstiloPosicion {
  if (!acertado) {
    return {
      fila: "border-border bg-card",
      badge: "bg-muted text-muted-foreground",
      nombre: "text-muted-foreground",
    };
  }

  if (posicion === 1) {
    return {
      fila: "border-[var(--gold)] bg-[var(--gold)]/10 shadow-[0_0_18px_-2px_var(--gold)]",
      badge: "bg-[var(--gold)] text-[#1a1200]",
      nombre: "text-[var(--gold)]",
    };
  }

  if (posicion === 2) {
    return {
      fila: "border-[var(--silver)] bg-[var(--silver)]/10 shadow-[0_0_18px_-2px_var(--silver)]",
      badge: "bg-[var(--silver)] text-[#1a1c20]",
      nombre: "text-[var(--silver)]",
    };
  }

  if (posicion === 3) {
    return {
      fila: "border-[var(--bronze)] bg-[var(--bronze)]/10 shadow-[0_0_18px_-2px_var(--bronze)]",
      badge: "bg-[var(--bronze)] text-[#1a0f00]",
      nombre: "text-[var(--bronze)]",
    };
  }

  return {
    fila: "border-primary/50 bg-primary/10",
    badge: "bg-primary text-primary-foreground",
    nombre: "text-primary",
  };
}

export function Top10Game() {
  const [ranking, setRanking] = useState<RankingTop10 | null>(null);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);

  const [acertados, setAcertados] = useState<EntradaTop10[]>([]);
  const [mensaje, setMensaje] = useState("");

  const [horaInicio, setHoraInicio] = useState(() => Date.now());
  const [tiempoFinal, setTiempoFinal] = useState<number | null>(null);
  const [rendido, setRendido] = useState(false);
  const [popupAbierto, setPopupAbierto] = useState(false);

  // Mismo patrón que GridBoard: descarta respuestas de peticiones obsoletas,
  // necesario porque React Strict Mode ejecuta el efecto de montaje dos veces
  // en desarrollo y si no se vería parpadear un ranking antes del definitivo.
  const cargaIdRef = useRef(0);

  useEffect(() => {
    cargarRanking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function cargarRanking() {
    const miCargaId = ++cargaIdRef.current;

    setCargando(true);
    setErrorCarga(null);
    setAcertados([]);
    setMensaje("");
    setTiempoFinal(null);
    setRendido(false);
    setPopupAbierto(false);

    try {
      // Se excluye el ranking actual para no repetirlo dos veces seguidas
      const query = ranking ? `?excluir=${encodeURIComponent(ranking.id)}` : "";
      const res = await fetch(`/api/top10/generar${query}`);

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo generar el Top 10.");
      }

      const nuevoRanking: RankingTop10 = await res.json();
      if (miCargaId !== cargaIdRef.current) return; // carga obsoleta

      setRanking(nuevoRanking);
      setHoraInicio(Date.now());
    } catch (err) {
      if (miCargaId !== cargaIdRef.current) return;
      setErrorCarga(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      if (miCargaId === cargaIdRef.current) setCargando(false);
    }
  }

  function estaAcertado(entrada: EntradaTop10): boolean {
    return acertados.some((a) => a.nombre === entrada.nombre);
  }

  // El buscador devuelve cualquier jugador de la base de datos, no solo los
  // del ranking: aquí se comprueba si el elegido está entre las respuestas.
  function procesarSeleccion(jugador: Jugador) {
    if (!ranking) return;

    const encontrada = buscarEntradaCoincidente(ranking.respuestas, jugador.nombre);

    if (!encontrada) {
      setMensaje(`${jugador.nombre} no está en este Top 10.`);
      return;
    }

    if (estaAcertado(encontrada)) {
      setMensaje(`${encontrada.nombre} ya ha sido colocado.`);
      return;
    }

    const nuevosAcertados = [...acertados, encontrada];
    setAcertados(nuevosAcertados);
    setMensaje(`¡${encontrada.nombre} correcto!`);

    if (nuevosAcertados.length === ranking.respuestas.length) {
      setMensaje("");
      setTiempoFinal(segundosTranscurridos(horaInicio));
      setPopupAbierto(true);
    }
  }

  function handleRendirse() {
    setMensaje("");
    setTiempoFinal(segundosTranscurridos(horaInicio));
    setRendido(true);
    setPopupAbierto(true);
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-muted-foreground">Cargando Top 10...</p>
      </div>
    );
  }

  if (errorCarga || !ranking) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-destructive">{errorCarga ?? "No se pudo cargar el Top 10."}</p>
        <GameButton onClick={cargarRanking}>Reintentar</GameButton>
      </div>
    );
  }

  const total = ranking.respuestas.length;
  const completado = acertados.length === total;
  const nombresAcertados = acertados.map((a) => a.nombre);

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <h1 className="text-center text-2xl font-bold text-foreground">{ranking.titulo}</h1>

      <div className="grid w-full max-w-md grid-flow-col grid-cols-2 grid-rows-5 gap-2 sm:flex sm:max-w-2xl sm:flex-col">
        {ranking.respuestas.map((entrada, i) => {
          const posicion = i + 1;
          const acertado = estaAcertado(entrada);
          const codigoPais = obtenerCodigoPais(entrada.nacionalidad);
          const estilo = obtenerEstiloPosicion(posicion, acertado);

          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-md border px-3 py-2 transition-all duration-300 sm:px-4 sm:py-3 ${estilo.fila}`}
            >
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold sm:h-7 sm:w-7 sm:text-sm ${estilo.badge}`}
              >
                {posicion}
              </span>
              <span
                className={`flex-1 text-center text-sm font-semibold sm:text-base ${estilo.nombre}`}
              >
                {acertado ? entrada.nombre : "???"}
              </span>
              <span className="flex items-center justify-end">
                {codigoPais && (
                  <span className={`fi fi-${codigoPais} h-3.75 w-5 rounded-sm sm:h-6 sm:w-9`} />
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex w-full max-w-xs gap-2">
        <PlayerSearch
          onSearch={buscarJugadores}
          excludeNames={nombresAcertados}
          excludedLabel="Ya acertado"
          onSelect={procesarSeleccion}
          placeholder="Escribe un jugador..."
        />
        <GameButton variant="destructive" onClick={handleRendirse}>
          Rendirse
        </GameButton>
      </div>

      <p className="text-sm text-muted-foreground">
        {acertados.length}/{total} acertados
      </p>

      {mensaje && !completado && !rendido && (
        <p className="text-sm text-muted-foreground">{mensaje}</p>
      )}

      {(completado || rendido) && (
        <GameResultDialog
          open={popupAbierto}
          onOpenChange={setPopupAbierto}
          resultado={completado ? "exito" : "fracaso"}
          titulo={completado ? "TOP 10 COMPLETADO" : "TOP 10 NO COMPLETADO"}
          descripcion={
            completado ? (
              <>
                Has acertado los {total} en{" "}
                <span className="font-semibold text-foreground">{tiempoFinal}</span> segundos.
              </>
            ) : (
              <>
                Te has rendido con{" "}
                <span className="font-semibold text-foreground">
                  {acertados.length}/{total}
                </span>{" "}
                acertados.
              </>
            )
          }
          onJugarDeNuevo={cargarRanking}
        />
      )}
    </div>
  );
}
