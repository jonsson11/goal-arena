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
  actualizarUsuario: (datos: Partial<Usuario>) => void;
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
    cargarUsuarioActual().finally(() => setCargando(false));
  }, []);

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
   * Actualiza el usuario SOLO en memoria (para que la UI reaccione al
   * instante, p.ej. al cambiar avatar en el diálogo de editar perfil). No
   * guarda nada en la base de datos -- eso todavía está pendiente de
   * conectar (fuera del alcance del login/registro).
   */
  function actualizarUsuario(datos: Partial<Usuario>) {
    setUsuario((actual) => (actual ? { ...actual, ...datos } : actual));
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
