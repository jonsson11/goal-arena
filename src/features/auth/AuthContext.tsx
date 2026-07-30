"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Usuario } from "@/features/profile/type";

type ResultadoAuth = { error?: string };

type AuthContextType = {
  usuario: Usuario | null;
  /** true mientras se comprueba si ya hay una sesión activa al cargar la app. */
  cargando: boolean;
  login: (email: string, password: string) => Promise<ResultadoAuth>;
  registrar: (nombre: string, email: string, password: string) => Promise<ResultadoAuth>;
  logout: () => Promise<void>;
  /** Guarda nombre/avatar/avatarTipo de verdad en la base de datos. */
  actualizarUsuario: (datos: Pick<Usuario, "nombre" | "avatar" | "avatarTipo">) => Promise<ResultadoAuth>;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [cargando, setCargando] = useState(true);

  async function cargarUsuarioActual() {
    try {
      const res = await fetch("/api/auth/me");
      const datos = await res.json();
      setUsuario(datos.usuario ?? null);
    } catch {
      setUsuario(null);
    }
  }

  useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- carga inicial de sesión al montar, es el patrón esperado
    cargarUsuarioActual().finally(() => setCargando(false));
  }, []);

  // "Heartbeat": mientras haya sesión y la pestaña esté abierta, avisa cada
  // minuto de que el usuario sigue activo (ver src/lib/presencia.ts --
  // es lo que permite mostrar "Conectado/Desconectado" en la lista de
  // amigos sin montar presencia en tiempo real).
  useEffect(() => {
    if (!usuario) return;

    function enviarHeartbeat() {
      fetch("/api/heartbeat", { method: "POST" }).catch(() => {
        // Sin conexión momentánea: no pasa nada, se reintenta en el siguiente tick.
      });
    }

    enviarHeartbeat();
    const intervalo = setInterval(enviarHeartbeat, 60_000);
    return () => clearInterval(intervalo);
  }, [usuario?.id]);

  async function login(email: string, password: string): Promise<ResultadoAuth> {
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    const datos = await res.json();
    if (!res.ok) return { error: datos.error as string };
    await cargarUsuarioActual();
    return {};
  }

  async function registrar(nombre: string, email: string, password: string): Promise<ResultadoAuth> {
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nombre, email, password }),
    });
    const datos = await res.json();
    if (!res.ok) return { error: datos.error as string };
    await cargarUsuarioActual();
    return {};
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    setUsuario(null);
  }

  /**
   * Guarda nombre/avatar/avatarTipo en la BD (tabla User) y, si sale bien,
   * actualiza el estado local con lo que confirma el servidor -- así la UI
   * nunca queda "adelantada" respecto a lo que de verdad quedó guardado.
   */
  async function actualizarUsuario(
    datos: Pick<Usuario, "nombre" | "avatar" | "avatarTipo">
  ): Promise<ResultadoAuth> {
    const res = await fetch("/api/perfil", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(datos),
    });
    const respuesta = await res.json();
    if (!res.ok) return { error: respuesta.error as string };
    setUsuario(respuesta.usuario as Usuario);
    return {};
  }

  return (
    <AuthContext.Provider value={{ usuario, cargando, login, registrar, logout, actualizarUsuario }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const contexto = useContext(AuthContext);
  if (!contexto) {
    throw new Error("useAuth debe usarse dentro de un AuthProvider");
  }
  return contexto;
}
