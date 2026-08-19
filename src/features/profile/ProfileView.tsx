"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { EditProfileDialog } from "./EditProfileDialog";
import { FriendsCarousel } from "./FriendsCarousel";
import { LogrosView } from "./LogrosView";
import { CosmeticosView } from "./CosmeticosView";
import { useLogrosReclamables } from "./LogrosReclamablesContext";
import { ligaMostrada } from "@/lib/trofeos";
import { AnilloLiga } from "@/features/ranked/AnilloLiga";
import type { Amigo } from "@/features/social/type";
import type { EstadisticasPerfil, TipoAvatar } from "./type";

type Pestana = "resumen" | "logros" | "cosmeticos";

// Mismo tamaño que TAMANO_AVATAR_PX de AccountMenu.tsx pero para el
// avatar grande del perfil (h-24 w-24 = 96px) -- AnilloLiga necesita el
// tamaño exacto en px para quedar pegado al borde del avatar de verdad.
const TAMANO_AVATAR_PERFIL_PX = 96;

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
  const { count: logrosReclamables } = useLogrosReclamables();
  const [editando, setEditando] = useState(false);
  const [pestana, setPestana] = useState<Pestana>("resumen");
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial (y recarga al cambiar de partida), es el patrón esperado
    setCargandoEstadisticas(true);
    fetch("/api/perfil/estadisticas")
      .then((res) => (res.ok ? res.json() : null))
      .then((datos) => setEstadisticas(datos))
      .catch(() => setEstadisticas(null))
      .finally(() => setCargandoEstadisticas(false));
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
  const liga = ligaMostrada(usuario.trofeos, usuario.trofeosMaximos, usuario.aroEquipado);

  const statsRapidas = [
    { valor: estadisticas?.total.partidasJugadas ?? 0, etiqueta: "Partidas" },
    { valor: `${estadisticas?.total.porcentajeVictoria ?? 0}%`, etiqueta: "% Victoria" },
    { valor: estadisticas?.rachaActual ?? 0, etiqueta: "Racha actual" },
    { valor: estadisticas?.rachaMaxima ?? 0, etiqueta: "Racha máxima" },
  ];

  return (
    <div className="mx-auto flex w-full max-w-2xl min-w-0 flex-col gap-8 px-6 py-10 overflow-x-hidden">
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
          {/* Aro de liga (Fase 5, 19/08/2026) -- mismo cosmético que el
              Header, respeta el que el jugador haya equipado en la
              pestaña "Cosméticos" en vez de forzar siempre la liga actual. */}
          <AnilloLiga liga={liga} tamano={TAMANO_AVATAR_PERFIL_PX} />
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

      <div className="flex justify-center gap-1 rounded-full border border-border bg-card p-1">
        <button
          onClick={() => setPestana("resumen")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
            pestana === "resumen"
              ? "bg-primary text-primary-foreground shadow-[0_0_16px_-2px_rgba(74,222,154,0.7)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Resumen
        </button>
        <button
          onClick={() => setPestana("logros")}
          className={`relative flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
            pestana === "logros"
              ? "bg-primary text-primary-foreground shadow-[0_0_16px_-2px_rgba(74,222,154,0.7)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Logros
          {logrosReclamables > 0 && (
            <span className="ml-2 rounded-full bg-destructive px-2 py-0.5 text-xs font-bold text-white">
              {logrosReclamables}
            </span>
          )}
        </button>
        <button
          onClick={() => setPestana("cosmeticos")}
          className={`flex-1 rounded-full px-4 py-2 text-sm font-semibold transition-all duration-200 ${
            pestana === "cosmeticos"
              ? "bg-primary text-primary-foreground shadow-[0_0_16px_-2px_rgba(74,222,154,0.7)]"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          Cosméticos
        </button>
      </div>

      <div
        className={
          pestana === "resumen"
            ? "animate-in fade-in slide-in-from-bottom-1 flex flex-col gap-8 duration-300"
            : "hidden"
        }
      >
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

        {/* "Por juego" (12/08/2026, petición del usuario): % de victoria
            agrupado SOLO por juego (LinkPlayers / 3x3 Grid / Top 10),
            independientemente del nivel -- a diferencia de "Por modo" de
            debajo, que sí desglosa GRID/LINKPLAYERS en fácil/medio/difícil.
            Las dos secciones conviven: esta da la foto rápida por juego,
            la de abajo el detalle por dificultad para quien lo quiera. */}
        {!cargandoEstadisticas && estadisticas && (estadisticas.porJuego?.length ?? 0) > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-foreground">Por juego</h2>
            <div className="grid grid-cols-3 gap-3">
              {estadisticas.porJuego.map((juego) => (
                <div
                  key={juego.clave}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:border-primary/40"
                >
                  <span className="truncate text-xs font-semibold text-foreground">{juego.etiqueta}</span>
                  <span className="text-lg font-extrabold text-primary">{juego.porcentajeVictoria}%</span>
                  <span className="text-xs text-muted-foreground">
                    {juego.partidasJugadas} {juego.partidasJugadas === 1 ? "partida" : "partidas"}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* "Por modo" (12/08/2026, 3ª ronda): antes desglosaba por
            dificultad exacta (hasta 4 tarjetas por juego, con etiquetas
            en bruto tipo "GRID:facil-online" cuando venía de una sala de
            multijugador) -- el usuario lo vio "feo" y demasiado
            fragmentado, y pidió agrupar solo por modalidad: "Grid Un
            jugador", "Grid Multijugador", así con cada juego. Ahora son
            siempre 6 tarjetas fijas (3 juegos x Un jugador/Multijugador,
            3 en cada fila), YA NO se ocultan las que no tienen ninguna
            partida -- salen con "Sin partidas" en vez de "0 partidas" --
            para que la rejilla quede siempre cuadrada en vez de
            reordenarse según lo que ya se ha jugado (route.ts ya manda
            las 6 combinaciones siempre, con partidasJugadas=0 en las que
            faltan). */}
        {!cargandoEstadisticas && estadisticas && estadisticas.porModo.length > 0 && (
          <div className="flex flex-col gap-3">
            <h2 className="text-lg font-bold text-foreground">Por modo</h2>
            <div className="grid grid-cols-3 gap-3">
              {estadisticas.porModo.map((modo) => (
                <div
                  key={modo.clave}
                  className="flex flex-col gap-1 rounded-lg border border-border bg-card p-3 transition-colors duration-200 hover:border-primary/40"
                >
                  <span className="truncate text-xs font-semibold text-foreground">{modo.etiqueta}</span>
                  {modo.partidasJugadas === 0 ? (
                    <span className="text-lg font-extrabold text-muted-foreground">Sin partidas</span>
                  ) : (
                    <>
                      <span className="text-lg font-extrabold text-primary">{modo.porcentajeVictoria}%</span>
                      <span className="text-xs text-muted-foreground">
                        {modo.partidasJugadas} {modo.partidasJugadas === 1 ? "partida" : "partidas"}
                      </span>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-col gap-3">
          <h2 className="text-lg font-bold text-foreground">Amigos</h2>
          <FriendsCarousel amigos={amigos} />
        </div>

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
      </div>

      <div
        className={
          pestana === "logros"
            ? "animate-in fade-in slide-in-from-bottom-1 duration-300 w-full min-w-0"
            : "hidden"
        }
      >
        <LogrosView />
      </div>

      <div
        className={
          pestana === "cosmeticos"
            ? "animate-in fade-in slide-in-from-bottom-1 duration-300 w-full min-w-0"
            : "hidden"
        }
      >
        <CosmeticosView />
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