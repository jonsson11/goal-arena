"use client";

import { useEffect, useRef, useState } from "react";
import { Link2, RotateCcw as UndoIcon } from "lucide-react";
import type { Dificultad, Jugador } from "@/features/games/shared/types";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import { ConfirmDialog } from "@/features/games/shared/ConfirmDialog";
import { useRegistrarPartida } from "@/features/games/shared/useRegistrarPartida";
import type { RespuestaPartida } from "@/lib/experiencia";
import type { PartidaGenerada, PasoCadena, PistaEtapa, ResultadoConexion } from "./type";

function segundosTranscurridos(inicio: number): number {
  return Math.floor((Date.now() - inicio) / 1000);
}

async function buscarJugadores(query: string): Promise<Jugador[]> {
  const res = await fetch(`/api/jugadores/buscar?q=${encodeURIComponent(query)}`);
  if (!res.ok) throw new Error("Error al buscar jugadores");
  return res.json();
}

async function verificarConexionApi(actual: string, siguiente: string): Promise<ResultadoConexion> {
  const res = await fetch("/api/jugadores/enlazar/verificar", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ actual, siguiente }),
  });
  if (!res.ok) throw new Error("No se pudo comprobar la conexión.");
  return res.json();
}

// Pistas de Stints bajo el nombre -- solo aparecen en fácil (equipo +
// años) y medio (solo equipo, ver PistaEtapa en type.ts). En difícil
// `pistas` viene undefined y este bloque no se pinta nada.
function PistasEtapas({ pistas, acento }: { pistas: PistaEtapa[]; acento: "primary" | "secondary" }) {
  if (pistas.length === 0) return null;

  const colorChip =
    acento === "primary" ? "border-primary/30 bg-primary/10 text-primary" : "border-secondary/30 bg-secondary/10 text-secondary";

  return (
    <div className="flex flex-wrap justify-center gap-1">
      {pistas.map((pista, i) => (
        <span key={i} className={`rounded-full border px-1.5 py-0.5 text-[9px] font-medium leading-tight ${colorChip}`}>
          {pista.equipo}
          {pista.temporada && <span className="opacity-70"> ({pista.temporada})</span>}
        </span>
      ))}
    </div>
  );
}

function TarjetaObjetivo({
  titulo,
  nombre,
  nacionalidad,
  imagenUrl,
  pistas,
  acento,
}: {
  titulo: string;
  nombre: string;
  nacionalidad: string;
  imagenUrl: string | null;
  pistas?: PistaEtapa[];
  acento: "primary" | "secondary";
}) {
  const codigoPais = obtenerCodigoPais(nacionalidad);
  const colorTexto = acento === "primary" ? "text-primary" : "text-secondary";
  const colorBorde = acento === "primary" ? "border-primary/40 bg-primary/10" : "border-secondary/40 bg-secondary/10";

  return (
    <div className={`flex flex-1 flex-col items-center gap-2 rounded-2xl border p-3 text-center ${colorBorde}`}>
      <span className={`text-[10px] font-bold uppercase tracking-widest ${colorTexto}`}>{titulo}</span>
      <div className="h-14 w-14 overflow-hidden rounded-full bg-gradient-to-br from-secondary to-primary/60 ring-1 ring-white/10">
        {imagenUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagenUrl} alt="" className="h-full w-full object-cover object-top" />
        ) : (
          <span className="flex h-full w-full items-center justify-center text-lg font-bold text-secondary-foreground">
            {nombre[0]}
          </span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        {codigoPais && <span className={`fi fi-${codigoPais} h-3 w-4 rounded-sm`} />}
        <p className="text-sm font-semibold text-foreground">{nombre}</p>
      </div>
      {pistas && <PistasEtapas pistas={pistas} acento={acento} />}
    </div>
  );
}

function EslabonCadena({ paso, esFinal }: { paso: PasoCadena; esFinal: boolean }) {
  return (
    <li className="flex flex-col gap-1">
      {paso.conexion && (
        <div className="flex items-center gap-1.5 pl-1 text-xs text-muted-foreground">
          <Link2 className="h-3 w-3 shrink-0 text-primary" />
          <span>
            Jugaron juntos en <span className="font-semibold text-foreground">{paso.conexion.equipo}</span> (
            {paso.conexion.temporada})
          </span>
        </div>
      )}
      <div
        className={`flex items-center gap-3 rounded-xl border px-3 py-2 ${
          esFinal ? "border-secondary/50 bg-secondary/10" : "border-white/10 bg-card/60"
        }`}
      >
        <span className="text-sm font-medium text-foreground">{paso.jugador.nombre}</span>
      </div>
    </li>
  );
}

// Bloque que se despliega en el cartel de resultado al pulsar "Mostrar
// respuestas correctas" -- reutiliza EslabonCadena para enseñar el camino
// más corto REAL (no solo su longitud) que ya venía en la respuesta de
// /api/jugadores/enlazar/generar desde el principio de la partida, solo
// que sin renderizar hasta ahora. Petición explícita del usuario
// (11/08/2026): antes solo se veía el número de Steps del mínimo, no el
// camino en sí, y quería poder consultarlo al perder/rendirse.
function CaminoSolucion({ camino }: { camino: PasoCadena[] }) {
  return (
    <ul className="flex w-full flex-col gap-2 rounded-xl border border-white/10 bg-background/40 p-3 text-left">
      {camino.map((paso, i) => (
        <EslabonCadena key={`${paso.jugador.nombre}-${i}`} paso={paso} esFinal={i === camino.length - 1} />
      ))}
    </ul>
  );
}

export function LinkPlayersGame({ dificultad }: { dificultad: Dificultad }) {
  const [partida, setPartida] = useState<PartidaGenerada | null>(null);
  const [cadena, setCadena] = useState<PasoCadena[]>([]);
  const [cargando, setCargando] = useState(true);
  const [errorCarga, setErrorCarga] = useState<string | null>(null);
  const [verificando, setVerificando] = useState(false);
  const [mensaje, setMensaje] = useState("");

  const [horaInicio, setHoraInicio] = useState(() => Date.now());
  const [tiempoFinal, setTiempoFinal] = useState<number | null>(null);
  const [rendido, setRendido] = useState(false);
  const [popupAbierto, setPopupAbierto] = useState(false);
  const [mostrandoCamino, setMostrandoCamino] = useState(false);
  const [experiencia, setExperiencia] = useState<RespuestaPartida | null>(null);
  const registrarPartida = useRegistrarPartida();

  const [confirmandoNuevaPartida, setConfirmandoNuevaPartida] = useState(false);
  const [confirmandoRendicion, setConfirmandoRendicion] = useState(false);

  // Mismo patrón que GridBoard/Top10Game: descarta respuestas de cargas
  // obsoletas (React Strict Mode monta el efecto dos veces en desarrollo).
  const cargaIdRef = useRef(0);

  useEffect(() => {
    cargarPartida();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dificultad]);

  const ganado = partida !== null && cadena.length > 0 && cadena[cadena.length - 1].jugador.nombre === partida.jugadorFinal.nombre;
  const terminada = ganado || rendido;
  const steps = Math.max(cadena.length - 1, 0);
  const nombresEnCadena = cadena.map((p) => p.jugador.nombre);

  async function cargarPartida() {
    const miCargaId = ++cargaIdRef.current;

    setCargando(true);
    setErrorCarga(null);
    setPartida(null);
    setCadena([]);
    setMensaje("");
    setTiempoFinal(null);
    setRendido(false);
    setPopupAbierto(false);
    setMostrandoCamino(false);
    setExperiencia(null);

    try {
      const res = await fetch(`/api/jugadores/enlazar/generar?dificultad=${dificultad}`);
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo generar la partida.");
      }

      const nuevaPartida: PartidaGenerada = await res.json();
      if (miCargaId !== cargaIdRef.current) return;

      setPartida(nuevaPartida);
      setCadena([{ jugador: nuevaPartida.jugadorInicial }]);
      setHoraInicio(Date.now());
    } catch (err) {
      if (miCargaId !== cargaIdRef.current) return;
      setErrorCarga(err instanceof Error ? err.message : "No se pudo generar la partida.");
    } finally {
      if (miCargaId === cargaIdRef.current) setCargando(false);
    }
  }

  async function manejarSeleccion(jugador: Jugador) {
    if (!partida || terminada || verificando) return;

    if (nombresEnCadena.includes(jugador.nombre)) {
      setMensaje(`${jugador.nombre} ya está en la cadena.`);
      return;
    }

    setVerificando(true);
    setMensaje("");

    try {
      const ultimo = cadena[cadena.length - 1].jugador;
      const resultado = await verificarConexionApi(ultimo.nombre, jugador.nombre);

      if (!resultado.conectados) {
        setMensaje(`${ultimo.nombre} y ${jugador.nombre} no coincidieron nunca en un club.`);
        return;
      }

      const nuevoPaso: PasoCadena = {
        jugador: { nombre: jugador.nombre, nacionalidad: jugador.nacionalidad, imagenUrl: jugador.imagenUrl },
        conexion: { equipo: resultado.equipoComun!, temporada: resultado.temporada! },
      };
      const nuevaCadena = [...cadena, nuevoPaso];
      setCadena(nuevaCadena);
      setMensaje("");

      if (jugador.nombre === partida.jugadorFinal.nombre) {
        const segundos = segundosTranscurridos(horaInicio);
        setTiempoFinal(segundos);
        setPopupAbierto(true);
        registrarPartida("LINKPLAYERS", dificultad, "victoria", segundos).then(setExperiencia);
      }
    } catch {
      setMensaje("No se pudo comprobar la conexión. Inténtalo de nuevo.");
    } finally {
      setVerificando(false);
    }
  }

  function revertirStep() {
    if (cadena.length <= 1 || terminada) return;
    setCadena((actual) => actual.slice(0, -1));
    setMensaje("");
  }

  function handleRendirse() {
    setMensaje("");
    setTiempoFinal(segundosTranscurridos(horaInicio));
    registrarPartida("LINKPLAYERS", dificultad, "derrota");
    setRendido(true);
    setPopupAbierto(true);
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-muted-foreground">Buscando dos jugadores para conectar...</p>
      </div>
    );
  }

  if (errorCarga || !partida) {
    return (
      <div className="flex flex-col items-center gap-4 p-6">
        <p className="text-sm text-destructive">{errorCarga ?? "No se pudo cargar la partida."}</p>
        <GameButton onClick={cargarPartida}>Reintentar</GameButton>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-5 p-3 sm:gap-6 sm:p-6">
      <div className="flex w-full max-w-2xl gap-3">
        <TarjetaObjetivo
          titulo="Jugador inicial"
          nombre={partida.jugadorInicial.nombre}
          nacionalidad={partida.jugadorInicial.nacionalidad}
          imagenUrl={partida.jugadorInicial.imagenUrl}
          pistas={partida.jugadorInicial.pistas}
          acento="primary"
        />
        <TarjetaObjetivo
          titulo="Jugador final"
          nombre={partida.jugadorFinal.nombre}
          nacionalidad={partida.jugadorFinal.nacionalidad}
          imagenUrl={partida.jugadorFinal.imagenUrl}
          pistas={partida.jugadorFinal.pistas}
          acento="secondary"
        />
      </div>

      <div className="flex items-center gap-4 text-sm">
        <span className="rounded-full border border-white/10 bg-card/60 px-3 py-1 text-muted-foreground">
          Camino más corto: <span className="font-bold text-foreground">{partida.distanciaMinima}</span>{" "}
          {partida.distanciaMinima === 1 ? "Step" : "Steps"}
        </span>
        <span className="rounded-full border border-white/10 bg-card/60 px-3 py-1 text-muted-foreground">
          Tus Steps: <span className="font-bold text-foreground">{steps}</span>
        </span>
      </div>

      <ul className="flex w-full max-w-md flex-col gap-2">
        {cadena.map((paso, i) => (
          <EslabonCadena key={`${paso.jugador.nombre}-${i}`} paso={paso} esFinal={i === cadena.length - 1 && ganado} />
        ))}
      </ul>

      <div className="flex w-full max-w-xs flex-col gap-2">
        <PlayerSearch
          onSearch={buscarJugadores}
          excludeNames={nombresEnCadena}
          excludedLabel="Ya en la cadena"
          onSelect={manejarSeleccion}
          placeholder="Escribe el siguiente jugador..."
          disabled={terminada || verificando}
        />
        <div className="flex gap-2">
          <GameButton
            variant="secondary"
            onClick={revertirStep}
            disabled={cadena.length <= 1 || terminada}
            className="flex flex-1 items-center justify-center gap-1.5"
          >
            <UndoIcon className="h-4 w-4" />
            Revertir Step
          </GameButton>
          <GameButton
            variant="destructive"
            onClick={() => setConfirmandoRendicion(true)}
            disabled={terminada}
            className="flex-1"
          >
            Rendirse
          </GameButton>
        </div>
      </div>

      <GameButton variant="secondary" onClick={() => setConfirmandoNuevaPartida(true)}>
        Nueva partida
      </GameButton>

      {mensaje && !terminada && <p className="max-w-xs text-center text-sm text-muted-foreground">{mensaje}</p>}

      <ConfirmDialog
        open={confirmandoNuevaPartida}
        onOpenChange={setConfirmandoNuevaPartida}
        titulo="¿Empezar una nueva partida?"
        descripcion="Se sortearán dos jugadores nuevos y perderás el progreso de la cadena actual."
        textoConfirmar="Sí, empezar de nuevo"
        onConfirmar={cargarPartida}
      />

      <ConfirmDialog
        open={confirmandoRendicion}
        onOpenChange={setConfirmandoRendicion}
        titulo="¿Rendirte?"
        descripcion="Se contará como derrota y no ganarás experiencia de esta partida."
        textoConfirmar="Sí, rendirme"
        onConfirmar={handleRendirse}
      />

      {terminada && (
        <GameResultDialog
          open={popupAbierto}
          onOpenChange={setPopupAbierto}
          resultado={ganado ? "exito" : "fracaso"}
          titulo={ganado ? "CADENA COMPLETADA" : "PARTIDA ABANDONADA"}
          descripcion={
            ganado ? (
              <>
                Llegaste de <span className="font-semibold text-foreground">{partida.jugadorInicial.nombre}</span> a{" "}
                <span className="font-semibold text-foreground">{partida.jugadorFinal.nombre}</span> en{" "}
                <span className="font-semibold text-foreground">{steps}</span>{" "}
                {steps === 1 ? "Step" : "Steps"} en <span className="font-semibold text-foreground">{tiempoFinal}</span>{" "}
                segundos.
                {steps === partida.distanciaMinima ? (
                  <> ¡El camino más corto posible!</>
                ) : (
                  <> El camino más corto era de {partida.distanciaMinima} {partida.distanciaMinima === 1 ? "Step" : "Steps"}.</>
                )}
              </>
            ) : (
              <>
                Te has rendido con <span className="font-semibold text-foreground">{steps}</span>{" "}
                {steps === 1 ? "Step" : "Steps"} dados. El camino más corto era de{" "}
                <span className="font-semibold text-foreground">{partida.distanciaMinima}</span>{" "}
                {partida.distanciaMinima === 1 ? "Step" : "Steps"}.
              </>
            )
          }
          onJugarDeNuevo={cargarPartida}
          experiencia={experiencia}
          respuestasCorrectas={{
            mostrando: mostrandoCamino,
            onToggle: () => setMostrandoCamino((actual) => !actual),
            contenido: <CaminoSolucion camino={partida.caminoSolucion} />,
          }}
        />
      )}
    </div>
  );
}
