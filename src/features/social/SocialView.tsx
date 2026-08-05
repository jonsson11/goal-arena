"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { useSolicitudesPendientes } from "@/features/social/SolicitudesContext";
import type { Amigo, SolicitudAmistad } from "./type";

type Pestana = "amigos" | "solicitudes";

// Mismas posiciones fijas que en /jugar -- unas pocas partículas quietas
// ya dan el efecto de fondo, sin necesidad de aleatoriedad.
const PARTICULAS = [
  { left: "6%", delay: "0s" },
  { left: "18%", delay: "3s" },
  { left: "35%", delay: "1.5s" },
  { left: "58%", delay: "4.5s" },
  { left: "74%", delay: "2s" },
  { left: "90%", delay: "5.5s" },
];

function AvatarChico({
  amigo,
  enLinea,
}: {
  amigo: Pick<Amigo, "avatar" | "avatarTipo" | "nombre">;
  /** Si se indica, dibuja el puntito de estado sobre el avatar (solo tiene sentido para amigos, no solicitudes). */
  enLinea?: boolean;
}) {
  const imagen =
    amigo.avatarTipo === "foto" ? (
      // eslint-disable-next-line @next/next/no-img-element -- foto de perfil de otro usuario (URL de Supabase Storage)
      <img
        src={amigo.avatar}
        alt={amigo.nombre}
        className="h-12 w-12 rounded-full border border-primary/40 object-cover"
      />
    ) : (
      <div className="flex h-12 w-12 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-xl">
        {amigo.avatar}
      </div>
    );

  if (enLinea === undefined) return imagen;

  return (
    <div className="relative shrink-0">
      {imagen}
      <span
        aria-hidden
        className={`absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card ${
          enLinea ? "bg-primary" : "bg-destructive/70"
        }`}
        style={enLinea ? { boxShadow: "0 0 8px 1px rgba(74,222,154,0.7)" } : undefined}
      />
    </div>
  );
}

export function SocialView() {
  const { usuario } = useAuth();
  const { setCount: setSolicitudesPendientes } = useSolicitudesPendientes();
  const [pestana, setPestana] = useState<Pestana>("amigos");
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [solicitudes, setSolicitudes] = useState<SolicitudAmistad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [nombreBuscado, setNombreBuscado] = useState("");
  const [mensaje, setMensaje] = useState("");
  const [error, setError] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function cargarAmigos() {
    try {
      const res = await fetch("/api/amigos");
      const datos = await res.json();
      if (res.ok) {
        setAmigos(datos.amigos ?? []);
        setSolicitudes(datos.solicitudes ?? []);
        // Fuente de verdad para el puntito del Header -- se recalcula aquí
        // desde la respuesta real de la API, no desde el estado local.
        setSolicitudesPendientes(datos.solicitudes?.length ?? 0);
      }
    } finally {
      setCargando(false);
    }
  }

  useEffect(() => {
    // Sin sesión no tiene sentido pedir /api/amigos (devolvería 401) --
    // se muestra la pantalla de "necesitas cuenta" (AuthGate más abajo)
    // en su lugar y no se lanza ningún fetch.
    if (!usuario) return;
    cargarAmigos();
  }, [usuario]);

  if (!usuario) {
    return (
      <AuthGate
        icono="🤝"
        titulo="¿Quieres jugar con amigos?"
        descripcion="Crea una cuenta o inicia sesión para añadir amigos, ver quién está conectado y competir en la sección Social."
        redirectTras="/social"
        aspectos={["👥 Lista de amigos", "🟢 Quién está conectado", "🔔 Solicitudes de amistad"]}
      />
    );
  }

  async function handleEnviarSolicitud() {
    const nombre = nombreBuscado.trim();
    if (!nombre) return;

    setEnviando(true);
    setMensaje("");
    setError("");
    try {
      const res = await fetch("/api/amigos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreUsuario: nombre }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(`Error: ${datos.error as string}`);
        return;
      }
      setMensaje(
        datos.aceptadaDirectamente
          ? `¡Ya sois amigos! ${nombre} te había enviado una solicitud antes.`
          : `Solicitud enviada a "${nombre}".`
      );
      setNombreBuscado("");
      await cargarAmigos();
    } finally {
      setEnviando(false);
    }
  }

  async function handleAceptar(solicitud: SolicitudAmistad) {
    setSolicitudes((actuales) => actuales.filter((s) => s.id !== solicitud.id));
    setSolicitudesPendientes((n) => n - 1);
    const res = await fetch(`/api/amigos/solicitudes/${solicitud.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "aceptar" }),
    });
    if (res.ok) {
      await cargarAmigos();
    } else {
      // Si falló, la volvemos a poner en la lista para no perderla de vista
      // (y el puntito del Header vuelve a contarla).
      setSolicitudes((actuales) => [...actuales, solicitud]);
      setSolicitudesPendientes((n) => n + 1);
    }
  }

  async function handleRechazar(solicitud: SolicitudAmistad) {
    setSolicitudes((actuales) => actuales.filter((s) => s.id !== solicitud.id));
    setSolicitudesPendientes((n) => n - 1);
    const res = await fetch(`/api/amigos/solicitudes/${solicitud.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accion: "rechazar" }),
    });
    if (!res.ok) {
      setSolicitudes((actuales) => [...actuales, solicitud]);
      setSolicitudesPendientes((n) => n + 1);
    }
  }

  async function handleEliminarAmigo(amigo: Amigo) {
    if (!confirm(`¿Seguro que quieres eliminar a ${amigo.nombre} de tus amigos?`)) return;

    setAmigos((actuales) => actuales.filter((a) => a.id !== amigo.id));
    const res = await fetch(`/api/amigos/${amigo.id}`, { method: "DELETE" });
    if (!res.ok) {
      // Si falló, lo devolvemos a la lista para no perderlo de vista.
      setAmigos((actuales) => [...actuales, amigo]);
    }
  }

  return (
    <div className="relative overflow-hidden">
      {PARTICULAS.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="particula-flotante pointer-events-none fixed h-[3px] w-[3px] rounded-full bg-primary opacity-35"
          style={{ left: p.left, animationDelay: p.delay }}
        />
      ))}

      <div className="relative z-10 mx-auto flex max-w-2xl flex-col gap-6 px-6 py-12">
        <div className="flex flex-col items-center gap-2">
          <h1
            className="text-shimmer bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
            style={{ textShadow: "0 0 30px rgba(74,222,154,0.25)" }}
          >
            Social
          </h1>
          <p className="mb-2 text-center text-sm text-muted-foreground">
            Tus amigos, sus solicitudes y quién anda en línea ahora mismo.
          </p>
        </div>

        {/* Buscador para añadir amigos */}
        <div className="relative flex flex-col items-center gap-3 overflow-hidden rounded-2xl border border-primary/30 bg-card p-6 shadow-[0_0_30px_-10px_rgba(74,222,154,0.4)]">
          <div
            aria-hidden
            className="pointer-events-none absolute -top-16 left-1/2 h-32 w-64 -translate-x-1/2 rounded-full bg-primary/10 blur-3xl motion-reduce:hidden"
          />
          <p className="relative text-sm font-semibold text-muted-foreground">
            Añade amigos por su nombre de usuario
          </p>
          <div className="relative flex w-full max-w-sm gap-2">
            <input
              value={nombreBuscado}
              onChange={(e) => setNombreBuscado(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleEnviarSolicitud();
              }}
              disabled={enviando}
              placeholder="Nombre de usuario..."
              className="flex-1 rounded-full border border-border bg-background/80 px-4 py-2 text-foreground transition-colors focus:border-primary/50 focus:outline-none disabled:opacity-50"
            />
            <GameButton onClick={handleEnviarSolicitud} disabled={enviando} className="rounded-full">
              {enviando ? "Enviando..." : "Añadir"}
            </GameButton>
          </div>
          {error && <p className="relative text-xs font-semibold text-destructive">{error}</p>}
          {mensaje && <p className="relative text-xs text-primary">{mensaje}</p>}
        </div>

        {/* Pestañas */}
        <div className="flex justify-center gap-1 rounded-full border border-border bg-card p-1">
          <button
            onClick={() => setPestana("amigos")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              pestana === "amigos"
                ? "bg-primary text-primary-foreground shadow-[0_0_16px_-2px_rgba(74,222,154,0.7)]"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Amigos ({amigos.length})
          </button>
          <button
            onClick={() => setPestana("solicitudes")}
            className={`relative flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
              pestana === "solicitudes"
                ? "bg-primary text-primary-foreground shadow-[0_0_16px_-2px_rgba(74,222,154,0.7)]"
                : "text-muted-foreground hover:text-foreground"
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

        {cargando ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Cargando...</p>
        ) : (
          <>
            {/* Contenido de la pestaña Amigos */}
            {pestana === "amigos" && (
              <div className="flex flex-col gap-2.5">
                {amigos.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Todavía no tienes amigos agregados.
                  </p>
                ) : (
                  amigos.map((amigo) => (
                    <div
                      key={amigo.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:bg-card/80 hover:shadow-[0_0_24px_-10px_rgba(74,222,154,0.5)]"
                    >
                      <Link
                        href={`/perfil/${amigo.nombre.toLowerCase()}`}
                        className="flex items-center gap-3 transition-opacity hover:opacity-80"
                      >
                        <AvatarChico amigo={amigo} enLinea={amigo.enLinea} />
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-foreground">{amigo.nombre}</span>
                          <span className="text-xs text-muted-foreground">Nivel {amigo.nivel}</span>
                        </div>
                      </Link>

                      <GameButton
                        variant="destructive"
                        onClick={() => handleEliminarAmigo(amigo)}
                        className="px-3 py-1.5 text-xs"
                      >
                        Eliminar
                      </GameButton>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Contenido de la pestaña Solicitudes */}
            {pestana === "solicitudes" && (
              <div className="flex flex-col gap-2.5">
                {solicitudes.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    No tienes solicitudes de amistad pendientes.
                  </p>
                ) : (
                  solicitudes.map((solicitud) => (
                    <div
                      key={solicitud.id}
                      className="flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-[0_0_24px_-10px_rgba(74,222,154,0.5)]"
                    >
                      <div className="flex items-center gap-3">
                        <AvatarChico amigo={solicitud} />
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
          </>
        )}
      </div>
    </div>
  );
}