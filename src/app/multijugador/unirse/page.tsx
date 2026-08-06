"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { TituloPagina } from "@/components/layout/TituloPagina";

export default function UnirseSalaPage() {
  const { usuario } = useAuth();
  const router = useRouter();

  const [codigo, setCodigo] = useState("");
  const [uniendo, setUniendo] = useState(false);
  const [error, setError] = useState("");

  if (!usuario) {
    return (
      <AuthGate
        icono="🎮"
        titulo="Juega con tus amigos"
        descripcion="Inicia sesión para unirte a una sala multijugador."
        redirectTras="/multijugador/unirse"
        aspectos={["🎮 Salas de 2 a 8", "⏱️ Mismo reto, en directo"]}
      />
    );
  }

  async function unirse() {
    const codigoLimpio = codigo.trim().toUpperCase();
    if (codigoLimpio.length !== 6) {
      setError("El código tiene 6 caracteres.");
      return;
    }

    setUniendo(true);
    setError("");
    try {
      const res = await fetch(`/api/salas/${codigoLimpio}/unirse`, { method: "POST" });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo unir a la sala.");
        return;
      }
      router.push(`/multijugador/sala/${codigoLimpio}`);
    } catch {
      setError("No se pudo unir a la sala. Comprueba tu conexión.");
    } finally {
      setUniendo(false);
    }
  }

  return (
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      {/* Título (con el botón "Atrás" dentro) fuera de la columna centrada
          -- mismo motivo que en /jugar/page.tsx. */}
      <TituloPagina acento="azul" hrefAtras="/multijugador" className="mb-2">
        Unirse a sala
      </TituloPagina>

      <div className="mx-auto flex max-w-sm flex-col items-center gap-6 text-center">
        <p className="text-sm text-muted-foreground">
          Escribe el código de 6 caracteres que te ha pasado tu amigo.
        </p>

        <div className="flex w-full flex-col gap-4 rounded-2xl border border-primary/25 bg-primary/[0.06] p-6 backdrop-blur-md">
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value.toUpperCase().slice(0, 6))}
            onKeyDown={(e) => {
              if (e.key === "Enter") unirse();
            }}
            placeholder="ABC123"
            autoCapitalize="characters"
            autoComplete="off"
            disabled={uniendo}
            className="w-full rounded-2xl border border-border bg-background/50 px-4 py-4 text-center text-3xl font-extrabold uppercase tracking-[0.3em] text-foreground outline-none transition-colors focus:border-primary/60 disabled:opacity-50"
          />

          {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

          <GameButton onClick={unirse} disabled={uniendo || codigo.length !== 6} className="w-full py-3 text-base">
            {uniendo ? "Uniéndose..." : "Unirse"}
          </GameButton>
        </div>
      </div>
    </div>
  );
}