"use client";

// src/app/multijugador/ranked/page.tsx
//
// El hub del modo competitivo (Fase 9, 19/08/2026) -- escudo de la liga
// actual, trofeos, barra de progreso a la siguiente liga, el botón de
// "Buscar partida" (que entra en la cola real de /api/ranked/cola y hace
// polling hasta emparejar), e historial reciente. Diseño según el mockup
// ya aprobado.

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Search, X } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { TituloPagina } from "@/components/layout/TituloPagina";
import { GameButton } from "@/features/games/shared/GameButton";
import { EscudoLiga } from "@/features/ranked/EscudoLiga";
import { progresoLiga } from "@/lib/trofeos";

const INTERVALO_POLLING_COLA_MS = 2000;

type EstadoColaAPI =
  | { estado: "esperando"; segundosEsperando: number; rangoAceptable: number }
  | { estado: "emparejado"; codigoSala: string }
  | { estado: "fuera" };

type ItemHistorial = {
  codigoSala: string;
  fecha: string;
  resultado: "VICTORIA" | "DERROTA" | "EMPATE";
  trofeosCambio: number;
  rival: { nombre: string; avatar: string; avatarTipo: "emoji" | "foto" } | null;
};

const ETIQUETA_RESULTADO: Record<ItemHistorial["resultado"], string> = {
  VICTORIA: "VICTORIA",
  DERROTA: "DERROTA",
  EMPATE: "EMPATE",
};

const CLASE_RESULTADO: Record<ItemHistorial["resultado"], string> = {
  VICTORIA: "bg-primary/15 text-primary",
  DERROTA: "bg-destructive/15 text-destructive",
  EMPATE: "bg-muted text-muted-foreground",
};

export default function RankedHubPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [trofeos, setTrofeos] = useState<number | null>(usuario?.trofeos ?? null);
  const [historial, setHistorial] = useState<ItemHistorial[] | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [segundosEsperando, setSegundosEsperando] = useState(0);
  const [error, setError] = useState<string | null>(null);

  // Refs (no estado) para poder limpiar el intervalo/cancelar la cola al
  // desmontar sin depender de una closure con el valor de estado
  // desactualizado -- patrón habitual con setInterval + React.
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const buscandoRef = useRef(false);

  const detenerPolling = useCallback(() => {
    if (intervaloRef.current) {
      clearInterval(intervaloRef.current);
      intervaloRef.current = null;
    }
  }, []);

  const manejarRespuestaCola = useCallback(
    (datos: EstadoColaAPI) => {
      if (datos.estado === "emparejado") {
        detenerPolling();
        buscandoRef.current = false;
        setBuscando(false);
        router.push(`/multijugador/sala/${datos.codigoSala}/partida`);
        return;
      }
      if (datos.estado === "esperando") {
        setSegundosEsperando(datos.segundosEsperando);
        return;
      }
      // "fuera" -- no debería pasar mientras `buscando` es true (solo se
      // llega aquí si canceló desde otra pestaña, o expiró); volvemos al
      // estado inicial en vez de dejar la UI colgada en "buscando...".
      detenerPolling();
      buscandoRef.current = false;
      setBuscando(false);
    },
    [detenerPolling, router]
  );

  async function iniciarBusqueda() {
    setError(null);
    try {
      const res = await fetch("/api/ranked/cola", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "No se pudo entrar en la cola.");
      const datos: EstadoColaAPI = await res.json();

      buscandoRef.current = true;
      setBuscando(true);
      manejarRespuestaCola(datos);

      if (datos.estado === "esperando") {
        intervaloRef.current = setInterval(async () => {
          try {
            const respuesta = await fetch("/api/ranked/cola");
            const datosPoll: EstadoColaAPI = await respuesta.json();
            manejarRespuestaCola(datosPoll);
          } catch {
            // Un poll suelto que falla (blip de red) no debería tirar toda
            // la búsqueda abajo -- el siguiente intervalo lo reintenta.
          }
        }, INTERVALO_POLLING_COLA_MS);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo buscar partida.");
      buscandoRef.current = false;
      setBuscando(false);
    }
  }

  async function cancelarBusqueda() {
    detenerPolling();
    buscandoRef.current = false;
    setBuscando(false);
    try {
      await fetch("/api/ranked/cola", { method: "DELETE" });
    } catch {
      // Si falla el DELETE no pasa nada grave -- la entrada de cola
      // quedará huérfana hasta el próximo intento de emparejar de otro
      // jugador (ver nota de limpieza pendiente en el documento de diseño).
    }
  }

  // Salir de la cola si el usuario navega fuera del hub mientras se está
  // buscando -- evita dejar entradas "fantasma" en ColaRanked (ver
  // documento de diseño, limpieza pendiente para el futuro).
  useEffect(() => {
    return () => {
      detenerPolling();
      if (buscandoRef.current) {
        fetch("/api/ranked/cola", { method: "DELETE" }).catch(() => {});
      }
    };
  }, [detenerPolling]);

  useEffect(() => {
    let cancelado = false;
    fetch("/api/ranked/estado")
      .then((r) => r.json())
      .then((datos: { trofeos: number; historial: ItemHistorial[] }) => {
        if (cancelado) return;
        setTrofeos(datos.trofeos);
        setHistorial(datos.historial);
      })
      .catch(() => {
        if (!cancelado) setHistorial([]);
      });
    return () => {
      cancelado = true;
    };
  }, []);

  if (!usuario) {
    return (
      <AuthGate
        icono="🏆"
        titulo="Compite por trofeos"
        descripcion="Crea una cuenta o inicia sesión para jugar partidas competitivas 1vs1 y subir en el ladder."
        redirectTras="/multijugador/ranked"
        aspectos={["🏆 Ladder por temporadas", "⚔️ Emparejamiento automático", "🎖️ Cosméticos por liga"]}
      />
    );
  }

  const trofeosMostrados = trofeos ?? usuario.trofeos;
  const progreso = progresoLiga(trofeosMostrados);

  return (
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      <TituloPagina acento="verde" hrefAtras="/multijugador" className="mb-2">
        Modo Competitivo
      </TituloPagina>

      <div className="relative z-10 mx-auto flex max-w-md flex-col items-center gap-5 text-center">
        <EscudoLiga liga={progreso.liga} tamano={112} />
        <div>
          <p className="text-xl font-extrabold text-foreground">{progreso.liga.nombre}</p>
          <p className="mt-1 flex items-center justify-center gap-1.5 text-2xl font-extrabold text-[#D4AF37]">
            🏆 {trofeosMostrados.toLocaleString("es-ES")}
          </p>
        </div>

        <div className="w-full px-2">
          <div className="h-2.5 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-primary to-[#7ef2bd] transition-all duration-700"
              style={{ width: `${progreso.porcentaje}%` }}
            />
          </div>
          <div className="mt-1.5 flex justify-between text-[11px] text-muted-foreground">
            <span>{progreso.liga.nombre}</span>
            <span>
              {progreso.siguiente ? `${progreso.trofeosParaSiguiente} para ${progreso.siguiente.nombre}` : "Liga máxima"}
            </span>
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!buscando ? (
          <GameButton
            type="button"
            onClick={iniciarBusqueda}
            className="mt-1 flex w-full items-center justify-center gap-2 py-3.5 text-base shadow-[0_0_0_1px_rgba(74,222,154,0.3),0_12px_30px_-10px_rgba(74,222,154,0.55)]"
          >
            <Search className="h-5 w-5" />
            Buscar partida
          </GameButton>
        ) : (
          <div className="mt-1 flex w-full flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 px-5 py-4">
            <p className="text-sm font-semibold text-foreground">
              Buscando rival… {segundosEsperando}s
            </p>
            <p className="text-xs text-muted-foreground">
              Puede tardar si no hay más gente jugando ahora mismo — no te vamos a emparejar con cualquiera,
              solo con rivales de un nivel razonable.
            </p>
            <GameButton type="button" variant="secondary" onClick={cancelarBusqueda} className="flex items-center gap-1.5">
              <X className="h-4 w-4" />
              Cancelar búsqueda
            </GameButton>
          </div>
        )}

        <Link href="/multijugador/ranked/ligas" className="text-xs text-secondary underline underline-offset-2">
          Ver todas las ligas ↓
        </Link>

        <div className="mt-2 flex w-full flex-col gap-2 text-left">
          <p className="px-1 text-xs font-bold uppercase tracking-wide text-muted-foreground">Partidas recientes</p>
          {historial === null && <p className="px-1 text-sm text-muted-foreground">Cargando…</p>}
          {historial !== null && historial.length === 0 && (
            <p className="px-1 text-sm text-muted-foreground">
              Todavía no has jugado ninguna partida competitiva — ¡busca la primera!
            </p>
          )}
          {historial?.map((item) => (
            <div
              key={item.codigoSala}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-3.5 py-2.5 text-sm"
            >
              <div className="flex items-center gap-2 truncate">
                <span className={`rounded-md px-1.5 py-0.5 text-[10px] font-extrabold ${CLASE_RESULTADO[item.resultado]}`}>
                  {ETIQUETA_RESULTADO[item.resultado]}
                </span>
                <span className="truncate text-muted-foreground">
                  vs {item.rival ? item.rival.nombre : "rival"}
                </span>
              </div>
              <span
                className={`shrink-0 font-bold ${item.trofeosCambio >= 0 ? "text-primary" : "text-destructive"}`}
              >
                {item.trofeosCambio >= 0 ? "+" : ""}
                {item.trofeosCambio} 🏆
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
