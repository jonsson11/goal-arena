"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { EditProfileDialog } from "./EditProfileDialog";
import { FriendsCarousel } from "./FriendsCarousel";
import { logros } from "./data";
import type { Amigo } from "@/features/social/type";
import type { EstadisticasPerfil, TipoAvatar } from "./type";

// "Hoy" / "Ayer" / "Hace N días" / fecha completa -- se compara por día de
// calendario local, no por diferencia de 24h exactas (si no, algo jugado
// ayer a las 23:50 y comprobado hoy a las 00:10 diría "hace 0 días").
function formatearFecha(iso: string): string {
  const fecha = new Date(iso);
  const inicioDia = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDias = Math.round((inicioDia(new Date()) - inicioDia(fecha)) / 86_400_000);

  if (diffDias === 0) return "Hoy";
  if (diffDias === 1) return "Ayer";
  if (diffDias > 1 && diffDias < 7) return `Hace ${diffDias} días`;
  return fecha.toLocaleDateString("es-ES", { day: "2-digit", month: "2-digit", year: "numeric" });
}

export function ProfileView() {
  const { usuario, actualizarUsuario } = useAuth();
  const [editando, setEditando] = useState(false);
  const [amigos, setAmigos] = useState<Amigo[]>([]);
  const [estadisticas, setEstadisticas] = useState<EstadisticasPerfil | null>(null);
  const [cargandoEstadisticas, setCargandoEstadisticas] = useState(true);

  useEffect(() => {
    if (!usuario) return;
    fetch("/api/amigos")
      .then((res) => res.json())
      .then((datos) => setAmigos(datos.amigos ?? []))
      .catch(() => setAmigos([]));
  }, [usuario]);

  useEffect(() => {
    if (!usuario) return;
    setCargandoEstadisticas(true);
    fetch("/api/perfil/estadisticas")
      .then((res) => (res.ok ? res.json() : null))
      .then((datos) => setEstadisticas(datos))
      .catch(() => setEstadisticas(null))
      .finally(() => setCargandoEstadisticas(false));
    // Se pide de nuevo también cuando cambia el nivel/XP del usuario --
    // es la señal más fiable de que se acaba de registrar una partida
    // nueva (ver useRegistrarPartida.ts), así el perfil no se queda con
    // las estadísticas de antes de jugar si vuelves aquí sin recargar.
  }, [usuario?.id, usuario?.nivel, usuario?.xpActual]);

  if (!usuario) {
    return (
      <AuthGate
        icono="🏆"
        titulo="Sigue tu progreso"
        descripcion="Crea una cuenta o inicia sesión para guardar tu nivel, tus rachas y tus logros, y comparar tus estadísticas con las de tus amigos."
        redirectTras="/perfil"
        aspectos={["📈 Nivel y XP", "🎖️ Logros desbloqueables", "📊 Historial de partidas"]}
      />
    );
  }

  async function guardarPerfil(nombre: string, avatar: string, avatarTipo: TipoAvatar) {
    const resultado = await actualizarUsuario({ nombre, avatar, avatarTipo });
    if (resultado.error) {
      alert(resultado.error);
      return false;
    }
    return true;
  }

  const porcentajeXp = Math.round((usuario.xpActual / usuario.xpSiguienteNivel) * 100);

  const statsRapidas = [
    { valor: estadisticas?.total.partidasJugadas ?? 0, etiqueta: "Partidas" },
    { valor: `${estadisticas?.total.porcentajeVictoria ?? 0}%`, etiqueta: "% Victoria" },
    { valor: estadisticas?.rachaActual ?? 0, etiqueta: "Racha actual" },
    { valor: estadisticas?.rachaMaxima ?? 0, etiqueta: "Racha máxima" },
  ];

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
      {/* Cabecera */}
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-primary/30 bg-card p-8 text-center shadow-[0_0_30px_-8px_rgba(74,222,154,0.4)]">
        <div className="relative">
          {usuario.avatarTipo === "foto" ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar personalizado del usuario (data URL)
            <img
              src={usuario.avatar}
              alt={usuario.nombre}
              className="h-24 w-24 rounded-full border-2 border-primary object-cover"
            />
          ) : (
            <div className="flex h-24 w-24 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-5xl">
              {usuario.avatar}
            </div>
          )}
          <div className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-card bg-primary text-xs font-extrabold text-primary-foreground shadow-[0_0_10px_-1px_rgba(74,222,154,0.8)]">
            {usuario.nivel}
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-foreground">{usuario.nombre}</h1>

        <div className="w-full max-w-xs">
          <div className="mb-1 flex justify-between text-xs font-semibold text-muted-foreground">
            <span>Nivel {usuario.nivel}</span>
            <span>
              {usuario.xpActual} / {usuario.xpSiguienteNivel} XP
            </span>
          </div>
          <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_8px_0_rgba(74,222,154,0.7)] transition-all duration-700"
              style={{ width: `${porcentajeXp}%` }}
            />
          </div>
        </div>

        <GameButton variant="secondary" onClick={() => setEditando(true)} className="mt-2">
          Editar perfil
        </GameButton>
      </div>

      {/* Resumen rápido */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {statsRapidas.map((stat) => (
          <div
            key={stat.etiqueta}
            className={`flex flex-col items-center gap-1 rounded-lg border border-border bg-card p-4 transition-all duration-200 hover:-translate-y-1 hover:border-primary/50 hover:shadow-[0_0_20px_-6px_rgba(74,222,154,0.5)] ${
              cargandoEstadisticas ? "animate-pulse" : ""
            }`}
          >
            <span className="text-2xl font-extrabold text-primary">{stat.valor}</span>
            <span className="text-center text-xs text-muted-foreground">{stat.etiqueta}</span>
          </div>
        ))}
      </div>

      {/* Desglose por modo -- solo si ya hay alguna partida jugada */}
      {!cargandoEstadisticas && estadisticas && estadisticas.porModo.length > 0 && (
        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-foreground">Por modo</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {estadisticas.porModo.map((modo) => (
              <div
                key={modo.clave}
                className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:border-primary/40"
              >
                <span className="truncate text-xs font-semibold text-foreground">{modo.etiqueta}</span>
                <span className="text-lg font-extrabold text-primary">{modo.porcentajeVictoria}%</span>
                <span className="text-xs text-muted-foreground">
                  {modo.partidasJugadas} {modo.partidasJugadas === 1 ? "partida" : "partidas"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Amigos */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Amigos</h2>
        <FriendsCarousel amigos={amigos} />
      </div>

      {/* Historial de partidas */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Partidas recientes</h2>

        {!cargandoEstadisticas && estadisticas?.historial.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border bg-card/50 px-4 py-6 text-center text-sm text-muted-foreground">
            Todavía no has jugado ninguna partida. ¡Ve a Jugar y estrena tu historial!
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {(estadisticas?.historial ?? []).map((partida) => (
              <div
                key={partida.id}
                className="flex items-center justify-between rounded-lg border border-border bg-card px-4 py-3 transition-all duration-200 hover:border-primary/40 hover:bg-card/80"
              >
                <div className="flex flex-col">
                  <span className="text-sm font-semibold text-foreground">{partida.etiqueta}</span>
                  {partida.resultado === "victoria" && (
                    <span className="text-xs font-semibold text-primary">+{partida.expGanada} EXP</span>
                  )}
                </div>

                <div className="flex flex-col items-end gap-1">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-bold ${
                      partida.resultado === "victoria"
                        ? "bg-primary/15 text-primary"
                        : "bg-destructive/15 text-destructive"
                    }`}
                  >
                    {partida.resultado === "victoria" ? "Victoria" : "Derrota"}
                  </span>
                  <span className="text-xs text-muted-foreground">{formatearFecha(partida.fecha)}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Logros */}
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-bold text-foreground">Logros</h2>

        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5">
          {logros.map((logro) => (
            <div
              key={logro.id}
              title={logro.desbloqueado ? logro.descripcion : "Bloqueado"}
              className={`flex flex-col items-center gap-2 rounded-lg border p-4 text-center transition-all duration-200 ${
                logro.desbloqueado
                  ? "border-primary/40 bg-primary/10 shadow-[0_0_16px_-4px_rgba(74,222,154,0.5)] hover:-translate-y-1 hover:shadow-[0_0_24px_-4px_rgba(74,222,154,0.7)]"
                  : "border-border bg-card opacity-40 grayscale hover:opacity-60"
              }`}
            >
              <span className="text-3xl">{logro.icono}</span>
              <span className="text-xs font-semibold text-foreground">{logro.nombre}</span>
            </div>
          ))}
        </div>
      </div>

      <EditProfileDialog
        open={editando}
        onOpenChange={setEditando}
        usuario={usuario}
        onGuardar={guardarPerfil}
      />
    </div>
  );
}
