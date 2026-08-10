"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { TituloPagina } from "@/components/layout/TituloPagina";
import type { Dificultad } from "@/features/games/shared/types";
import type { JuegoMultijugador } from "@/features/multijugador/type";

const OPCIONES_DIFICULTAD: { valor: Dificultad; etiqueta: string }[] = [
  { valor: "facil", etiqueta: "Fácil" },
  { valor: "medio", etiqueta: "Medio" },
  { valor: "dificil", etiqueta: "Difícil" },
];

const ESTILO_POR_DIFICULTAD: Record<Dificultad, { fondo: string; texto: string }> = {
  facil: { fondo: "#4ADE9A", texto: "#0B1220" },
  medio: { fondo: "#E8A93D", texto: "#241300" },
  dificil: { fondo: "#E0524F", texto: "#FFFFFF" },
};

const OPCIONES_MAX_JUGADORES = [2, 3, 4, 5, 6, 7, 8];

const OPCIONES_JUEGO: { valor: JuegoMultijugador; etiqueta: string }[] = [
  { valor: "GRID", etiqueta: "3x3 Grid" },
  { valor: "TOP10", etiqueta: "Top 10" },
];

export default function CrearSalaPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [juego, setJuego] = useState<JuegoMultijugador>("GRID");
  const [dificultad, setDificultad] = useState<Dificultad>("medio");
  const [maxJugadores, setMaxJugadores] = useState(2);
  const [creando, setCreando] = useState(false);
  const [error, setError] = useState("");

  if (!usuario) {
    return (
      <AuthGate
        icono="🎮"
        titulo="Juega con tus amigos"
        descripcion="Inicia sesión para crear una sala multijugador."
        redirectTras="/multijugador/crear"
        aspectos={["🎮 Salas de 2 a 8", "⏱️ Mismo reto, en directo"]}
      />
    );
  }

  async function crearSala() {
    setCreando(true);
    setError("");
    try {
      const res = await fetch("/api/salas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // TOP10 no tiene dificultad -- no hace falta mandarla, el servidor
        // solo la exige (y la usa) cuando juego === "GRID".
        body: JSON.stringify(juego === "GRID" ? { juego, dificultad, maxJugadores } : { juego, maxJugadores }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo crear la sala.");
        return;
      }
      router.push(`/multijugador/sala/${datos.codigo}`);
    } catch {
      setError("No se pudo crear la sala. Comprueba tu conexión.");
    } finally {
      setCreando(false);
    }
  }

  return (
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      {/* Título (con el botón "Atrás" dentro) fuera de la columna centrada
          -- mismo motivo que en /jugar/page.tsx. */}
      <TituloPagina acento="azul" hrefAtras="/multijugador" className="mb-2">
        Crear sala
      </TituloPagina>

      <div className="mx-auto flex max-w-lg flex-col gap-8">
        <p className="text-center text-sm text-muted-foreground">
          Configura la partida antes de invitar a tus amigos.
        </p>

        <div className="flex flex-col gap-8 rounded-2xl border border-secondary/25 bg-secondary/[0.06] p-6 backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-foreground">Juego</span>
            <div className="grid grid-cols-2 gap-2">
              {OPCIONES_JUEGO.map((opcion) => {
                const activo = juego === opcion.valor;
                return (
                  <button
                    key={opcion.valor}
                    onClick={() => setJuego(opcion.valor)}
                    className={`touch-manipulation rounded-xl border px-4 py-3 text-center text-sm font-bold transition-all duration-200 ${
                      activo
                        ? "border-secondary bg-secondary/15 text-secondary"
                        : "border-border text-muted-foreground hover:border-secondary/50"
                    }`}
                  >
                    {opcion.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          {/* TOP10 no tiene dificultad (un solo modo, igual que en el
              individual) -- este selector solo tiene sentido para GRID. */}
          {juego === "GRID" && (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold text-foreground">Dificultad</span>
              <div className="grid grid-cols-3 gap-2">
                {OPCIONES_DIFICULTAD.map((opcion) => {
                  const activa = dificultad === opcion.valor;
                  const estilo = ESTILO_POR_DIFICULTAD[opcion.valor];
                  return (
                    <button
                      key={opcion.valor}
                      onClick={() => setDificultad(opcion.valor)}
                      className="touch-manipulation rounded-xl border px-3 py-3 text-sm font-bold transition-all duration-200"
                      style={
                        activa
                          ? { backgroundColor: estilo.fondo, color: estilo.texto, borderColor: estilo.fondo }
                          : { borderColor: "var(--border)", color: "var(--muted-foreground)" }
                      }
                    >
                      {opcion.etiqueta}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-foreground">Número de jugadores</span>
            <div className="grid grid-cols-7 gap-1.5">
              {OPCIONES_MAX_JUGADORES.map((n) => {
                const activo = maxJugadores === n;
                return (
                  <button
                    key={n}
                    onClick={() => setMaxJugadores(n)}
                    className={`touch-manipulation rounded-lg border py-2.5 text-sm font-bold transition-all duration-200 ${
                      activo
                        ? "border-secondary bg-secondary text-secondary-foreground"
                        : "border-border text-muted-foreground hover:border-secondary/50"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
            <p className="text-xs text-muted-foreground">De 2 (1vs1) a 8 jugadores en la misma sala.</p>
          </div>

          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

          <GameButton onClick={crearSala} disabled={creando} className="w-full py-3 text-base">
            {creando ? "Creando sala..." : "Crear sala"}
          </GameButton>
        </div>
      </div>
    </div>
  );
}