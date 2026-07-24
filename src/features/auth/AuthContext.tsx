"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import type { Usuario } from "@/features/profile/type";
import { usuarioInicial } from "@/features/profile/data";

type AuthContextType = {
  usuario: Usuario | null;
  login: () => void;
  logout: () => void;
  actualizarUsuario: (datos: Partial<Usuario>) => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [usuario, setUsuario] = useState<Usuario | null>(null);

  function login() {
    setUsuario(usuarioInicial);
  }

  function logout() {
    setUsuario(null);
  }

  function actualizarUsuario(datos: Partial<Usuario>) {
    setUsuario((actual) => (actual ? { ...actual, ...datos } : actual));
  }

  return (
    <AuthContext.Provider value={{ usuario, login, logout, actualizarUsuario }}>
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