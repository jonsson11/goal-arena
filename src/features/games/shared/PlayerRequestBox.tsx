// src/features/shared/PlayerRequestBox.tsx
"use client";

import { useState } from "react";
import { GameButton } from "@/features/games/shared/GameButton";

interface PlayerRequestBoxProps {
  titulo?: string;
  descripcion?: string;
  className?: string;
}

type Estado = "idle" | "enviando" | "exito" | "error";

export function PlayerRequestBox({
  titulo = "¿Falta algún jugador?",
  descripcion = "Dinos el nombre y lo añadimos a la base de datos.",
  className = "",
}: PlayerRequestBoxProps) {
  const [nombre, setNombre] = useState("");
  const [nota, setNota] = useState("");
  const [empresa, setEmpresa] = useState(""); // honeypot: los bots suelen rellenar todos los campos
  const [estado, setEstado] = useState<Estado>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) return;

    setEstado("enviando");
    setErrorMsg("");

    try {
      const res = await fetch("/api/solicitudes/jugador", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombre: nombre.trim(), nota: nota.trim(), empresa }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.error ?? "No se pudo enviar la solicitud.");
      }

      setEstado("exito");
      setNombre("");
      setNota("");
    } catch (err) {
      setEstado("error");
      setErrorMsg(err instanceof Error ? err.message : "Error desconocido.");
    }
  }

  if (estado === "exito") {
    return (
      <div className={`rounded-xl border border-primary/40 bg-primary/10 p-4 text-center ${className}`}>
        <p className="text-sm font-semibold text-foreground">¡Gracias! Lo revisaremos pronto.</p>
        <button
          onClick={() => setEstado("idle")}
          className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
        >
          Pedir otro jugador
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className={`flex flex-col gap-3 rounded-xl border border-border bg-card p-4 ${className}`}
    >
      <div>
        <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
        <p className="text-xs text-muted-foreground">{descripcion}</p>
      </div>

      {/* Honeypot: invisible para humanos, los bots lo rellenan igual que cualquier otro campo */}
      <input
        type="text"
        value={empresa}
        onChange={(e) => setEmpresa(e.target.value)}
        className="hidden"
        tabIndex={-1}
        autoComplete="off"
      />

      <input
        type="text"
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del jugador"
        required
        maxLength={120}
        className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
      />

      <textarea
        value={nota}
        onChange={(e) => setNota(e.target.value)}
        placeholder="Contexto opcional (equipo, liga...)"
        maxLength={300}
        rows={2}
        className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary"
      />

      {estado === "error" && <p className="text-xs text-destructive">{errorMsg}</p>}

      <GameButton
        type="submit"
        disabled={estado === "enviando" || !nombre.trim()}
        className="text-sm"
      >
        {estado === "enviando" ? "Enviando..." : "Enviar solicitud"}
      </GameButton>
    </form>
  );
}