"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import type { Dificultad } from "@/features/games/shared/types";
import type { JuegoMultijugador } from "@/features/multijugador/type";

const OPCIONES_DIFICULTAD: { valor: Dificultad; etiqueta: string }[] = [
  { valor: "facil", etiqueta: "Fácil" },
  { valor: "medio", etiqueta: "Medio" },
  { valor: "dificil", etiqueta: "Difícil" },
];

// Mismos colores semáforo que ya usa GameLauncher.tsx para la dificultad
// en modo individual -- se repiten aquí (no se ha extraído a un sitio
// compartido) porque solo se usan en estos dos sitios y no compensa
// todavía crear un módulo solo para 6 líneas de constantes.
const ESTILO_POR_DIFICULTAD: Record<Dificultad, { fondo: string; texto: string }> = {
  facil: { fondo: "#4ADE9A", texto: "#0B1220" },
  medio: { fondo: "#E8A93D", texto: "#241300" },
  dificil: { fondo: "#E0524F", texto: "#FFFFFF" },
};

const OPCIONES_MAX_JUGADORES = [2, 3, 4, 5, 6, 7, 8];

export default function CrearSalaPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [juego] = useState<JuegoMultijugador>("GRID"); // único disponible hoy
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
        body: JSON.stringify({ juego, dificultad, maxJugadores }),
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
    <div className="mx-auto flex max-w-lg flex-col gap-8 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Link href="/multijugador" className="mb-2 self-start text-xs font-bold text-secondary">
          ← Multijugador
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight text-foreground">Crear sala</h1>
        <p className="text-sm text-muted-foreground">Configura la partida antes de invitar a tus amigos.</p>
      </div>

      <div className="flex flex-col gap-3">
        <span className="text-sm font-semibold text-foreground">Juego</span>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-secondary bg-secondary/10 px-4 py-3 text-center text-sm font-bold text-secondary">
            3x3 Grid
          </div>
          <div className="cursor-not-allowed rounded-xl border border-border bg-card px-4 py-3 text-center text-sm font-semibold text-muted-foreground opacity-60">
            Top 10 <span className="block text-[10px] font-normal">Próximamente</span>
          </div>
        </div>
      </div>

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
        <p className="text-xs text-muted-foreground">
          De 2 (1vs1) a 8 jugadores en la misma sala.
        </p>
      </div>

      {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

      <GameButton onClick={crearSala} disabled={creando} className="w-full py-3 text-base">
        {creando ? "Creando sala..." : "Crear sala"}
      </GameButton>
    </div>
  );
}