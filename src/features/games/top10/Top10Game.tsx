"use client";

import { useEffect, useRef, useState } from "react";
import type { Jugador } from "@/features/games/shared/types";
import { obtenerCodigoPais } from "@/features/games/shared/banderas";
import { GameResultDialog } from "@/features/games/shared/GameResultDialog";
import { GameButton } from "@/features/games/shared/GameButton";
import { PlayerSearch } from "@/features/games/shared/PlayerSearch";
import { useRegistrarPartida } from "@/features/games/shared/useRegistrarPartida";
import type { RespuestaPartida } from "@/lib/experiencia";
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

// Partículas habituales de apellidos compuestos -- mismo criterio que
// nombreParaCasilla en GridBoard.tsx, para que "Kevin De Bruyne" abrevie a
// "K. De Bruyne" y no a "K. Bruyne".
const PARTICULAS_APELLIDO = new Set([
  "de", "del", "van", "von", "der", "den", "du", "la", "le", "dos", "das", "do", "da", "di", "al",
]);

/** "Federico Valverde" -> "F. Valverde". Un nombre de una sola palabra se deja tal cual. */
function abreviarNombre(nombreCompleto: string): string {
  const palabras = nombreCompleto.trim().split(/\s+/);
  if (palabras.length === 1) return nombreCompleto;

  let inicio = palabras.length - 1;
  while (inicio > 0 && PARTICULAS_APELLIDO.has(palabras[inicio - 1].toLowerCase())) {
    inicio--;
  }

  const apellido = palabras.slice(inicio).join(" ");
  return `${palabras[0][0]}. ${apellido}`;
}

// Mide el hueco real disponible con ResizeObserver y decide si el nombre
// completo cabe o hay que abreviarlo -- más fiable que adivinar un umbral
// de container query, porque no depende de calcular a mano cuánto se
// "come" el resto de la fila (badge, valor, bandera).
function NombreAbreviable({ nombre, className }: { nombre: string; className?: string }) {
  const contenedorRef = useRef<HTMLSpanElement>(null);
  const medidorRef = useRef<HTMLSpanElement>(null);
  const [cabeEntero, setCabeEntero] = useState(true);

  useEffect(() => {
    const contenedor = contenedorRef.current;
    const medidor = medidorRef.current;
    if (!contenedor || !medidor) return;

    function comprobar() {
      if (!contenedor || !medidor) return;
      // +1px de margen para no oscilar por redondeos de subpíxel.
      setCabeEntero(medidor.scrollWidth <= contenedor.clientWidth + 1);
    }

    comprobar();
    const observer = new ResizeObserver(comprobar);
    observer.observe(contenedor);
    return () => observer.disconnect();
  }, [nombre]);

  return (
    <span ref={contenedorRef} className={`relative block min-w-0 overflow-hidden ${className ?? ""}`}>
      {/* Medidor invisible y fuera de flujo: mide el ancho que ocuparía el
          nombre completo sin recortar, para compararlo contra el hueco
          real (contenedor.clientWidth). No afecta al layout visible. */}
      <span ref={medidorRef} aria-hidden className="invisible absolute left-0 top-0 whitespace-nowrap">
        {nombre}
      </span>
      <span className="block truncate">{cabeEntero ? nombre : abreviarNombre(nombre)}</span>
    </span>
  );
}

type EstiloPosicion = {
  fila: string;
  badge: string;
  nombre: string;
};

// "pendiente": todavía "???" (no acertado, y no se han revelado las
// respuestas). "fallado": te rendiste, pulsaste "Mostrar respuestas" y
// esta fila no la habías acertado -- se enseña con halo rojo, igual que
// pediste, para distinguirla de un acierto real (dorado/plata/bronce/
// verde) sin confundir al jugador sobre qué puso él y qué no.
type EstadoFila = "pendiente" | "acertado" | "fallado";

function obtenerEstiloPosicion(posicion: number, estado: EstadoFila): EstiloPosicion {
  if (estado === "pendiente") {
    return {
      fila: "border-border bg-card",
      badge: "bg-muted text-muted-foreground",
      nombre: "text-muted-foreground",
    };
  }

  if (estado === "fallado") {
    return {
      fila: "border-destructive/50 bg-destructive/10 shadow-[0_0_18px_-4px_var(--destructive)]",
      // "text-white" a propósito, no "text-destructive-foreground" -- ese
      // token no está definido en globals.css (solo existe --destructive),
      // así que la clase de Tailwind saldría sin color real.
      badge: "bg-destructive text-white",
      nombre: "text-destructive",
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
  const [mostrandoRespuestas, setMostrandoRespuestas] = useState(false);
  const [experiencia, setExperiencia] = useState<RespuestaPartida | null>(null);
  const registrarPartida = useRegistrarPartida();

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
    setMostrandoRespuestas(false);
    setExperiencia(null);

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
      // Una sola llamada, reusada para el marcador y para el registro --
      // igual que en GridBoard, para que no puedan desincronizarse.
      const segundos = segundosTranscurridos(horaInicio);
      setMensaje("");
      setTiempoFinal(segundos);
      setPopupAbierto(true);
      registrarPartida("TOP10", null, "victoria", segundos).then(setExperiencia);
    }
  }

  function handleRendirse() {
    setMensaje("");
    setTiempoFinal(segundosTranscurridos(horaInicio));
    registrarPartida("TOP10", null, "derrota");
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

      {/* En móvil, una sola columna a lo ancho completo (grid-cols-1, sin
          grid-flow-col): antes, con 2 columnas forzadas siempre, cada
          tarjeta tenía la mitad del ancho disponible para nombre + valor +
          bandera, y NombreAbreviable acababa recortando nombres ya
          abreviados a un par de letras ("J.A..."). Además, con
          grid-flow-col + grid-rows-5 el orden visual era 1-5 en la columna
          izquierda y 6-10 en la derecha, lo que hacía fácil confundir, p.
          ej., el 6 con el 7 (uno arriba-derecha, otro no visualmente
          contiguo al 5). En una sola columna el orden 1..10 va de arriba a
          abajo tal cual, sin ambigüedad. A partir de sm: se recupera el
          layout de 2 columnas de siempre, que en pantallas más anchas sí
          tiene hueco de sobra. */}
      <div className="grid w-full max-w-2xl grid-cols-1 gap-2.5 sm:grid-flow-col sm:grid-cols-2 sm:grid-rows-5 sm:gap-3">
        {ranking.respuestas.map((entrada, i) => {
          const posicion = i + 1;
          const acertado = estaAcertado(entrada);
          // Revelado por "Mostrar respuestas" tras rendirte -- se enseña el
          // nombre real igual que un acierto, pero con halo rojo (estilo
          // "fallado") en vez del color de posición, para que no se
          // confunda con algo que sí colocaste tú.
          const fallado = !acertado && mostrandoRespuestas;
          const revelado = acertado || fallado;
          const codigoPais = obtenerCodigoPais(entrada.nacionalidad);
          const estilo = obtenerEstiloPosicion(posicion, acertado ? "acertado" : fallado ? "fallado" : "pendiente");

          return (
            <div
              key={i}
              className={`isolate flex items-center gap-2.5 rounded-md border px-4 py-3 transition-all duration-300 sm:px-5 sm:py-4 ${estilo.fila} ${
                revelado ? "animate-in zoom-in-95 fade-in slide-in-from-left-1 duration-300" : ""
              }`}
            >
              <span
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-sm font-bold sm:h-7 sm:w-7 sm:text-sm ${estilo.badge}`}
              >
                {posicion}
              </span>
              {/* Pegado al número, no centrado. En vez de encoger la letra
                  hasta ilegible cuando el nombre es largo, NombreAbreviable
                  mide con ResizeObserver el hueco real que le queda al
                  nombre (ya descontados badge/bandera) y decide si cabe
                  entero o hay que abreviarlo ("F. Valverde"). Con el ancho
                  completo en móvil (ver comentario del grid arriba), este
                  hueco real es mucho mayor y el nombre entero cabe casi
                  siempre.

                  El valor (goles, edad...) va DEBAJO del nombre, en
                  pequeño, no pegado a su derecha -- con valores cortos
                  ("46") cabía bien en línea, pero con textos largos como
                  una edad formateada ("40 años, 4 meses y 17 días") ese
                  hueco fijo (shrink-0) se comía todo el ancho y dejaba el
                  nombre sin sitio donde pintarse. Así siempre hay hueco de
                  sobra para el nombre, sea cual sea el valor. */}
              <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
                {revelado ? (
                  <NombreAbreviable
                    nombre={entrada.nombre}
                    className={`text-left font-semibold text-lg sm:text-xl ${estilo.nombre}`}
                  />
                ) : (
                  <span
                    className={`min-w-0 truncate text-left font-semibold text-base sm:text-base ${estilo.nombre}`}
                  >
                    ???
                  </span>
                )}
                {revelado && (
                  <span
                    className={`animate-in fade-in truncate text-left text-xs font-medium opacity-80 duration-300 sm:text-sm ${estilo.nombre}`}
                  >
                    {entrada.valorTexto ?? entrada.valor}
                  </span>
                )}
              </div>
              <span className="flex shrink-0 items-center justify-end">
                {codigoPais && (
                  <span className={`fi fi-${codigoPais} h-4.5 w-6 rounded-sm sm:h-6 sm:w-9`} />
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
          // Tablero bloqueado al terminar (o al enseñar las respuestas):
          // antes no se deshabilitaba nunca, así que técnicamente se podía
          // seguir colocando jugadores después de rendirte.
          disabled={completado || rendido}
        />
        <GameButton variant="destructive" onClick={handleRendirse} disabled={completado || rendido}>
          Rendirse
        </GameButton>
      </div>

      <GameButton variant="secondary" onClick={cargarRanking}>
        Cambiar Top10
      </GameButton>

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
          experiencia={experiencia}
          // Solo al rendirte tiene sentido "revelar" -- si completaste el
          // Top10 ya se ve entero en el tablero, no hay nada que enseñar.
          respuestasCorrectas={
            rendido
              ? {
                  mostrando: mostrandoRespuestas,
                  onToggle: () => setMostrandoRespuestas((actual) => !actual),
                  // El propio tablero (detrás de este cartel, cierra con la
                  // X) es el que se rellena en rojo -- aquí solo un aviso
                  // corto para que sepas dónde mirar, sin duplicar la lista.
                  contenido: (
                    <p className="text-sm text-muted-foreground">
                      Cierra este cartel para ver el Top 10 completo: lo que te faltaba aparece
                      marcado en rojo.
                    </p>
                  ),
                }
              : undefined
          }
        />
      )}
    </div>
  );
}