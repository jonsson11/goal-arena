"use client";

// src/features/profile/LogrosReclamablesContext.tsx
//
// Mismo patrón exacto que SolicitudesContext.tsx (features/social) --
// contador global para el puntito de notificación en el Header (junto a
// "Perfil") y para el badge de la pestaña "Logros" dentro del propio
// Perfil, así los dos sitios muestran siempre el mismo número sin
// depender de quién pidió los datos primero.
//
// El contador cuenta logros en estado "reclamable" (desbloqueados pero
// sin reclamar) -- baja en cuanto se reclama uno de verdad, nunca por
// "marcarlo como visto".

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/features/auth/AuthContext";

type ActualizadorCount = number | ((actual: number) => number);

type LogrosReclamablesContextType = {
  count: number;
  refrescar: () => Promise<void>;
  setCount: (valor: ActualizadorCount) => void;
};

const LogrosReclamablesContext = createContext<LogrosReclamablesContextType | null>(null);

const INTERVALO_REFRESCO_MS = 60_000;

export function LogrosReclamablesProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [count, setCountState] = useState(0);
  const montadoRef = useRef(true);

  const refrescar = useCallback(async () => {
    if (!usuario) return;
    try {
      const res = await fetch("/api/perfil/logros");
      if (!res.ok) return;
      const datos = await res.json();
      if (!montadoRef.current) return;
      const logros = Array.isArray(datos.logros) ? datos.logros : [];
      setCountState(logros.filter((l: { estado: string }) => l.estado === "reclamable").length);
    } catch {
      // Sin conexión momentánea: se reintenta en el siguiente ciclo o refresco manual.
    }
  }, [usuario]);

  useEffect(() => {
    montadoRef.current = true;
    return () => {
      montadoRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!usuario) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- reset al cerrar sesión
      setCountState(0);
      return;
    }

    refrescar();
    const intervalo = setInterval(refrescar, INTERVALO_REFRESCO_MS);
    return () => clearInterval(intervalo);
  }, [usuario, refrescar]);

  const setCount = useCallback((valor: ActualizadorCount) => {
    setCountState((actual) => {
      const siguiente = typeof valor === "function" ? valor(actual) : valor;
      return Math.max(0, siguiente);
    });
  }, []);

  return (
    <LogrosReclamablesContext.Provider value={{ count, refrescar, setCount }}>
      {children}
    </LogrosReclamablesContext.Provider>
  );
}

export function useLogrosReclamables() {
  const ctx = useContext(LogrosReclamablesContext);
  if (!ctx) {
    throw new Error("useLogrosReclamables debe usarse dentro de <LogrosReclamablesProvider>");
  }
  return ctx;
}