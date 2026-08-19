"use client";

// Rediseño "lomo de color" (Fase 10, 19/08/2026): el selector de "Juego"
// pasaba por 3 botones de texto plano, todos en el mismo color secundario
// sin importar qué juego representaban -- perdía la identidad de icono +
// color por juego que sí tienen /jugar y el resto de menús. Ahora
// reutiliza directamente `JUEGOS` (icono, nombre, acento) para que el
// selector de aquí sea, literalmente, el mismo dato que pinta las
// tarjetas de /jugar. El panel contenedor también pasó de cristal
// teñido de secundario a fondo sólido (`bg-card`), coherente con el resto
// de tarjetas del rediseño (ya no quedan superficies "de cristal"
// sueltas). Dificultad y número de jugadores se dejan igual -- son
// selectores de un valor (no identidad de juego), ya con su propio
// código de color por dificultad.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { TituloPagina } from "@/components/layout/TituloPagina";
import { JUEGOS } from "@/features/games/shared/juegos";
import { ICONO_FONDO_POR_ACENTO, SELECTOR_ACTIVO_POR_ACENTO, TEXTO_POR_ACENTO } from "@/features/games/shared/acento";
import type { Dificultad } from "@/features/games/shared/types";
import type { JuegoMultijugador } from "@/features/multijugador/type";

// `JUEGOS` (en features/games/shared/juegos.ts) no lleva el valor de
// enum que espera la API de salas (`JuegoMultijugador`) -- se relaciona
// aquí por href en vez de por posición del array, para que si el orden
// de `JUEGOS` cambia algún día esto no se desincronice en silencio.
const VALOR_POR_HREF: Record<string, JuegoMultijugador> = {
  "/jugar/grid": "GRID",
  "/jugar/linkplayers": "LINKPLAYERS",
  "/jugar/top10": "TOP10",
};

const JUEGOS_SELECCIONABLES = JUEGOS.map((j) => ({ ...j, valor: VALOR_POR_HREF[j.href] }));

const OPCIONES_DIFICULTAD: { valor: Dificultad; etiqueta: string }[] = [
  { valor: "facil", etiqueta: "Fácil" },
  { valor: "medio", etiqueta: "Medio" },
  { valor: "dificil", etiqueta: "Difícil" },
];

// Mismas etiquetas que el selector de dificultad del modo individual (ver
// /jugar/linkplayers/page.tsx) -- LinkPlayers habla en "jugadores
// intermedios", no en "Fácil/Medio/Difícil" (petición del usuario,
// 12/08/2026). Duplicado a propósito (misma razón que ese archivo: no se
// puede compartir sin arrastrar código de servidor a un componente
// cliente, y solo son unas pocas líneas).
const OPCIONES_DIFICULTAD_LINKPLAYERS: { valor: Dificultad; etiqueta: string }[] = [
  { valor: "facil", etiqueta: "1-2" },
  { valor: "medio", etiqueta: "3-4" },
  { valor: "dificil", etiqueta: "5-7" },
];

const ESTILO_POR_DIFICULTAD: Record<Dificultad, { fondo: string; texto: string }> = {
  facil: { fondo: "#4ADE9A", texto: "#0B1220" },
  medio: { fondo: "#E8A93D", texto: "#241300" },
  dificil: { fondo: "#E0524F", texto: "#FFFFFF" },
};

const OPCIONES_MAX_JUGADORES = [2, 3, 4, 5, 6, 7, 8];

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
        // solo la exige (y la usa) cuando juego === "GRID" o "LINKPLAYERS".
        body: JSON.stringify(
          juego === "GRID" || juego === "LINKPLAYERS" ? { juego, dificultad, maxJugadores } : { juego, maxJugadores }
        ),
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

        <div className="flex flex-col gap-8 rounded-2xl border border-border bg-card p-6 backdrop-blur-md sm:p-8">
          <div className="flex flex-col gap-3">
            <span className="text-sm font-semibold text-foreground">Juego</span>
            <div className="grid grid-cols-3 gap-2">
              {JUEGOS_SELECCIONABLES.map((j) => {
                const activo = juego === j.valor;
                const Icono = j.Icono;
                return (
                  <button
                    key={j.valor}
                    onClick={() => setJuego(j.valor)}
                    className={`flex touch-manipulation flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-200 ${
                      activo ? SELECTOR_ACTIVO_POR_ACENTO[j.acento] : "border-border hover:border-muted-foreground/40"
                    }`}
                  >
                    <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${ICONO_FONDO_POR_ACENTO[j.acento]}`}>
                      <Icono className="h-5 w-5" />
                    </span>
                    <span className={`text-xs font-bold ${activo ? TEXTO_POR_ACENTO[j.acento] : "text-muted-foreground"}`}>
                      {j.nombre}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* TOP10 no tiene dificultad (un solo modo, igual que en el
              individual) -- este selector solo tiene sentido para GRID y
              LINKPLAYERS. LinkPlayers usa sus propias etiquetas ("1-2"
              jugadores intermedios, etc.) en vez de Fácil/Medio/Difícil. */}
          {(juego === "GRID" || juego === "LINKPLAYERS") && (
            <div className="flex flex-col gap-3">
              <span className="text-sm font-semibold text-foreground">Dificultad</span>
              <div className="grid grid-cols-3 gap-2">
                {(juego === "GRID" ? OPCIONES_DIFICULTAD : OPCIONES_DIFICULTAD_LINKPLAYERS).map((opcion) => {
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