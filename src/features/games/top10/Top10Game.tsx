"use client";
import { obtenerBandera } from "@/features/games/shared/banderas";
import { useState } from "react";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import type { EntradaTop10, RankingTop10 } from "./type";
import { rankings } from "./data";
import { buscarEntradaCoincidente } from "./logic";

const RANKING_ACTUAL: RankingTop10 = rankings[0];

function segundosTranscurridos(inicio: number): number {
  return Math.floor((Date.now() - inicio) / 1000);
}

export function Top10Game() {
  const [acertados, setAcertados] = useState<EntradaTop10[]>([]);
  const [textoEscrito, setTextoEscrito] = useState("");
  const [mensaje, setMensaje] = useState("");

  const [horaInicio, setHoraInicio] = useState(() => Date.now());
  const [tiempoFinal, setTiempoFinal] = useState<number | null>(null);
  const [rendido, setRendido] = useState(false);
  const [popupAbierto, setPopupAbierto] = useState(false);

  const completado = acertados.length === RANKING_ACTUAL.respuestas.length;

  function estaAcertado(entrada: EntradaTop10): boolean {
    return acertados.some((a) => a.nombre === entrada.nombre);
  }

  function handleComprobar() {
    if (!textoEscrito.trim()) return;

    const encontrada = buscarEntradaCoincidente(RANKING_ACTUAL.respuestas, textoEscrito);

    if (!encontrada) {
      setMensaje("Ese nombre no está en el Top 10.");
      setTextoEscrito("");
      return;
    }

    if (estaAcertado(encontrada)) {
      setMensaje(`${encontrada.nombre} ya ha sido colocado.`);
      setTextoEscrito("");
      return;
    }

    const nuevosAcertados = [...acertados, encontrada];
    setAcertados(nuevosAcertados);
    setMensaje(`¡${encontrada.nombre} correcto!`);
    setTextoEscrito("");

    if (nuevosAcertados.length === RANKING_ACTUAL.respuestas.length) {
      setTiempoFinal(segundosTranscurridos(horaInicio));
      setPopupAbierto(true);
    }
  }

  function handleRendirse() {
    setTiempoFinal(segundosTranscurridos(horaInicio));
    setRendido(true);
    setPopupAbierto(true);
  }

  function jugarDeNuevo() {
    setAcertados([]);
    setTextoEscrito("");
    setMensaje("");
    setHoraInicio(Date.now());
    setTiempoFinal(null);
    setRendido(false);
    setPopupAbierto(false);
  }

  return (
    <div className="flex flex-col items-center gap-6 p-6">
      <h1 className="text-center text-2xl font-bold text-foreground">
        {RANKING_ACTUAL.titulo}
      </h1>

      <div className="flex w-full max-w-md flex-col gap-2">
        {RANKING_ACTUAL.respuestas.map((entrada, i) => {
          const acertado = estaAcertado(entrada);

          return (
            <div
              key={i}
              className={`flex items-center justify-between rounded-md border px-4 py-3 ${
                acertado ? "border-primary/50 bg-primary/10" : "border-border bg-card"
              }`}
            >
              <span className="text-sm font-semibold text-muted-foreground">#{i + 1}</span>
              <span
                className={`flex-1 text-center font-semibold ${
                  acertado ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {acertado ? entrada.nombre : "???"}
              </span>
              <span className="flex items-center gap-2 text-sm text-muted-foreground">
                <span className="text-lg">{obtenerBandera(entrada.nacionalidad)}</span>
                {entrada.nacionalidad}
</span>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          value={textoEscrito}
          onChange={(e) => setTextoEscrito(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleComprobar();
          }}
          placeholder="Escribe un jugador..."
          className="rounded-md border border-border bg-card px-3 py-2 text-foreground"
        />
        <button
          onClick={handleComprobar}
          className="rounded-md bg-primary px-4 py-2 font-semibold text-primary-foreground"
        >
          Comprobar
        </button>
        <button
          onClick={handleRendirse}
          className="rounded-md bg-destructive px-4 py-2 font-semibold text-white transition-opacity hover:opacity-90"
        >
          Rendirse
        </button>
      </div>

      <p className="text-sm text-muted-foreground">
        {acertados.length}/{RANKING_ACTUAL.respuestas.length} acertados
      </p>

      {mensaje && <p className="text-sm text-muted-foreground">{mensaje}</p>}

      {(completado || rendido) && (
        <GameResultDialog
          open={popupAbierto}
          onOpenChange={setPopupAbierto}
          resultado={completado ? "exito" : "fracaso"}
          titulo={completado ? "TOP 10 COMPLETADO" : "TOP 10 NO COMPLETADO"}
          descripcion={
            completado ? (
              <>
                Has acertado los 10 en{" "}
                <span className="font-semibold text-foreground">{tiempoFinal}</span> segundos.
              </>
            ) : (
              <>
                Te has rendido con{" "}
                <span className="font-semibold text-foreground">{acertados.length}/10</span>{" "}
                acertados.
              </>
            )
          }
          onJugarDeNuevo={jugarDeNuevo}
        />
      )}
    </div>
  );
}