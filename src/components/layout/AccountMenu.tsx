"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/AuthContext";

export function AccountMenu() {
  const { usuario, logout } = useAuth();
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);

  async function handleLogout() {
    await logout();
    setAbierto(false);
    router.push("/login");
  }

  if (!usuario) {
    return (
      <Link
        href="/login"
        className="rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
      >
        Iniciar sesión
      </Link>
    );
  }

  const porcentajeXp = Math.min(100, Math.round((usuario.xpActual / usuario.xpSiguienteNivel) * 100));

  return (
    <div className="flex items-center gap-2.5">
      {/* Nombre + barra de XP, junto al avatar. Ya no se oculta entera en
          móvil (antes "hidden sm:flex") -- ahora se queda la barrita
          siempre visible, solo más estrecha (w-10 en vez de w-20) y sin
          nombre/chip de nivel de texto (eso lo sigue dando la insignia
          numérica pegada al propio avatar, ver más abajo) para que quepa
          justo al lado del avatar y la hamburguesa sin apretar el header. */}
      <Link
        href="/perfil"
        className="group flex flex-col items-end gap-1"
        title={`${usuario.xpActual} / ${usuario.xpSiguienteNivel} XP`}
      >
        <span className="hidden max-w-[140px] truncate text-xs font-semibold text-foreground transition-colors group-hover:text-primary sm:block">
          {usuario.nombre}
        </span>
        <div className="flex items-center gap-1.5">
          {/* Mismo estilo de "chip" que el nivel en ExperienciaGanada.tsx --
              solo desde "sm": en móvil el número de nivel ya lo da la
              insignia sobre el avatar, repetirlo aquí sería redundante y
              no hay sitio. */}
          <span className="hidden rounded-full bg-primary/15 px-2 py-0.5 text-xs font-bold text-primary sm:inline">
            Nv. {usuario.nivel}
          </span>
          {/* Contorno fino verde neón alrededor de la barra -- antes era
              solo el relleno sin borde, se perdía contra el fondo oscuro.
              w-10 en móvil, w-20 desde "sm" (misma barra, solo más ancha). */}
          <div className="h-2 w-10 overflow-hidden rounded-full border border-primary/70 bg-muted shadow-[0_0_5px_0_rgba(74,222,154,0.55)] sm:w-20">
            <div
              className="h-full rounded-full bg-primary shadow-[0_0_6px_0_rgba(74,222,154,0.7)] transition-all duration-700"
              style={{ width: `${porcentajeXp}%` }}
            />
          </div>
        </div>
      </Link>

      <div className="relative">
        <button
          onClick={() => setAbierto(!abierto)}
          className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-primary bg-primary/10 text-lg transition-opacity hover:opacity-80"
        >
          {usuario.avatarTipo === "foto" ? (
            // eslint-disable-next-line @next/next/no-img-element -- avatar personalizado del usuario (data URL)
            <img
              src={usuario.avatar}
              alt={usuario.nombre}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            usuario.avatar
          )}
        </button>

        {/* Mismo dato (nivel) que la barra de al lado, en formato insignia
            -- solo en móvil, donde la barra ya no lleva el chip "Nv. X" de
            texto (no había sitio para los dos). */}
        <span className="absolute -bottom-1 -right-1 flex h-[18px] w-[18px] items-center justify-center rounded-full border-2 border-background bg-primary text-[9px] font-extrabold text-primary-foreground sm:hidden">
          {usuario.nivel}
        </span>

        {abierto && (
          <div className="absolute right-0 top-full mt-2 w-56 rounded-lg border border-border bg-card p-2 shadow-[0_8px_30px_-6px_rgba(0,0,0,0.5)]">
            <div className="border-b border-border px-3 py-2">
              <p className="text-sm font-semibold text-foreground">{usuario.nombre}</p>
              <p className="text-xs text-muted-foreground">Nivel {usuario.nivel}</p>
            </div>

            <Link
              href="/perfil"
              onClick={() => setAbierto(false)}
              className="block rounded-md px-3 py-2 text-sm text-foreground transition-colors hover:bg-muted"
            >
              Configuración
            </Link>

            <button
              onClick={handleLogout}
              className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
            >
              Cerrar sesión
            </button>
          </div>
        )}
      </div>
    </div>
  );
}