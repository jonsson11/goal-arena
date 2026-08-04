"use client";

// Contexto global para el contador de solicitudes de amistad pendientes.
// Existe para que el puntito verde de notificación en el Header (NavLinks,
// tanto en escritorio como en el menú móvil) y la pestaña "Solicitudes"
// de /social muestren siempre el mismo número, sin depender de quién
// cargó los datos primero.
//
// El contador solo baja cuando una solicitud se acepta o se rechaza de
// verdad (a propósito: no hay concepto de "marcar como leído", el
// puntito representa solicitudes SIN RESOLVER, no sin ver).

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

type SolicitudesContextType = {
  count: number;
  /** Vuelve a pedir /api/amigos y recalcula el contador desde cero. */
  refrescar: () => Promise<void>;
  /** Ajuste optimista (ej. al aceptar/rechazar) sin esperar a un refetch. */
  setCount: (valor: ActualizadorCount) => void;
};

const SolicitudesContext = createContext<SolicitudesContextType | null>(null);

// Mismo intervalo que el heartbeat de presencia (src/features/auth/AuthContext.tsx)
// -- ya establece el "late" del resto de la app, no hace falta uno más agresivo.
const INTERVALO_REFRESCO_MS = 60_000;

export function SolicitudesProvider({ children }: { children: ReactNode }) {
  const { usuario } = useAuth();
  const [count, setCountState] = useState(0);
  const montadoRef = useRef(true);

  const refrescar = useCallback(async () => {
    if (!usuario) return;
    try {
      const res = await fetch("/api/amigos");
      if (!res.ok) return;
      const datos = await res.json();
      if (!montadoRef.current) return;
      setCountState(Array.isArray(datos.solicitudes) ? datos.solicitudes.length : 0);
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
    <SolicitudesContext.Provider value={{ count, refrescar, setCount }}>
      {children}
    </SolicitudesContext.Provider>
  );
}

export function useSolicitudesPendientes() {
  const ctx = useContext(SolicitudesContext);
  if (!ctx) {
    throw new Error("useSolicitudesPendientes debe usarse dentro de <SolicitudesProvider>");
  }
  return ctx;
}
