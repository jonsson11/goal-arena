"use client";

import { useState } from "react";
import Link from "next/link";
import { useAuth } from "@/features/auth/AuthContext";

export function AccountMenu() {
  const { usuario, logout } = useAuth();
  const [abierto, setAbierto] = useState(false);

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

  return (
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
            onClick={() => {
              logout();
              setAbierto(false);
            }}
            className="block w-full rounded-md px-3 py-2 text-left text-sm text-destructive transition-colors hover:bg-destructive/10"
          >
            Cerrar sesión
          </button>
        </div>
      )}
    </div>
  );
}