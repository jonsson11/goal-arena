"use client";

import { useState } from "react";
import Link from "next/link";
import { GameButton } from "@/features/games/shared/GameButton";
import { amigosIniciales, solicitudesIniciales } from "./data";
import type { Amigo, SolicitudAmistad } from "./type";

type Pestana = "amigos" | "solicitudes";

export function SocialView() {
  const [pestana, setPestana] = useState<Pestana>("amigos");
  const [amigos, setAmigos] = useState<Amigo[]>(amigosIniciales);
  const [solicitudes, setSolicitudes] = useState<SolicitudAmistad[]>(solicitudesIniciales);
  const [nombreBuscado, setNombreBuscado] = useState("");
  const [mensaje, setMensaje] = useState("");

  function handleEnviarSolicitud() {
    const nombre = nombreBuscado.trim();
    if (!nombre) return;

    setMensaje(`Solicitud enviada a @${nombre}.`);
    setNombreBuscado("");
  }

  function handleAceptar(solicitud: SolicitudAmistad) {
    const nuevoAmigo: Amigo = {
      id: solicitud.id,
      nombre: solicitud.nombre,
      avatar: solicitud.avatar,
      nivel: solicitud.nivel,
      enLinea: false,
    };

    setAmigos([...amigos, nuevoAmigo]);
    setSolicitudes(solicitudes.filter((s) => s.id !== solicitud.id));
  }

  function handleRechazar(solicitud: SolicitudAmistad) {
    setSolicitudes(solicitudes.filter((s) => s.id !== solicitud.id));
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-10">
      <h1 className="text-center text-3xl font-extrabold tracking-tight text-foreground">
        Social
      </h1>

      {/* Buscador para añadir amigos */}
      <div className="flex flex-col items-center gap-3 rounded-2xl border border-primary/30 bg-card p-6 shadow-[0_0_30px_-10px_rgba(74,222,154,0.4)]">
        <p className="text-sm font-semibold text-muted-foreground">
          Añade amigos por su nombre de usuario
        </p>
        <div className="flex w-full max-w-sm gap-2">
          <input
            value={nombreBuscado}
            onChange={(e) => setNombreBuscado(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleEnviarSolicitud();
            }}
            placeholder="Nombre de usuario..."
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-foreground"
          />
          <GameButton onClick={handleEnviarSolicitud}>Añadir</GameButton>
        </div>
        {mensaje && <p className="text-xs text-primary">{mensaje}</p>}
      </div>

      {/* Pestañas */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setPestana("amigos")}
          className={`border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            pestana === "amigos"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Amigos ({amigos.length})
        </button>
        <button
          onClick={() => setPestana("solicitudes")}
          className={`relative border-b-2 px-4 py-2 text-sm font-semibold transition-colors ${
            pestana === "solicitudes"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground"
          }`}
        >
          Solicitudes
          {solicitudes.length > 0 && (
            <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
              {solicitudes.length}
            </span>
          )}
        </button>
      </div>

      {/* Contenido de la pestaña Amigos */}
      {pestana === "amigos" && (
        <div className="flex flex-col gap-2">
          {amigos.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Todavía no tienes amigos agregados.
            </p>
          ) : (
            amigos.map((amigo) => (
              <div
                key={amigo.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-all duration-200 hover:border-primary/40 hover:bg-card/80"
              >
                <Link
                  href={`/perfil/${amigo.nombre.toLowerCase()}`}
                  className="flex items-center gap-3 transition-opacity hover:opacity-80"
                >
                  <div className="relative flex h-11 w-11 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xl">
                    {amigo.avatar}
                    <span
                      className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${
                        amigo.enLinea ? "bg-primary" : "bg-muted-foreground"
                      }`}
                    />
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">{amigo.nombre}</span>
                    <span className="text-xs text-muted-foreground">Nivel {amigo.nivel}</span>
                  </div>
                </Link>

                <span
                  className={`text-xs font-semibold ${
                    amigo.enLinea ? "text-primary" : "text-muted-foreground"
                  }`}
                >
                  {amigo.enLinea ? "Conectado" : "Desconectado"}
                </span>
              </div>
            ))
          )}
        </div>
      )}

      {/* Contenido de la pestaña Solicitudes */}
      {pestana === "solicitudes" && (
        <div className="flex flex-col gap-2">
          {solicitudes.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No tienes solicitudes de amistad pendientes.
            </p>
          ) : (
            solicitudes.map((solicitud) => (
              <div
                key={solicitud.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3"
              >
                <div className="flex items-center gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-full border border-secondary/40 bg-secondary/10 text-xl">
                    {solicitud.avatar}
                  </div>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground">
                      {solicitud.nombre}
                    </span>
                    <span className="text-xs text-muted-foreground">Nivel {solicitud.nivel}</span>
                  </div>
                </div>

                <div className="flex gap-2">
                  <GameButton onClick={() => handleAceptar(solicitud)} className="px-3 py-1.5 text-xs">
                    Aceptar
                  </GameButton>
                  <GameButton
                    variant="destructive"
                    onClick={() => handleRechazar(solicitud)}
                    className="px-3 py-1.5 text-xs"
                  >
                    Rechazar
                  </GameButton>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}