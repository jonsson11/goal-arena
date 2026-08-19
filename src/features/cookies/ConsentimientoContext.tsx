"use client";

// src/features/cookies/ConsentimientoContext.tsx
//
// Contexto compartido con la decisión de cookies del usuario. Vive en la
// raíz (ver layout.tsx) para que tanto el banner como el footer ("Gestionar
// cookies", para poder cambiar de opinión más tarde) como el futuro script
// de AdSense lean/escriban el mismo estado sin pasarlo a mano por props.
//
// null = todavía no ha decidido (banner visible). "aceptado"/"rechazado" =
// ya decidió (banner oculto, hasta que pulse "Gestionar cookies").

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  guardarConsentimiento,
  leerConsentimiento,
  type DecisionConsentimiento,
  type EstadoConsentimiento,
} from "./consentimiento";

type ConsentimientoContextValue = {
  /** undefined = todavía no se ha leído localStorage (primer render en servidor/hidratación).
   *  null = leído, el usuario no ha decidido todavía.
   *  EstadoConsentimiento = ya decidió. */
  estado: EstadoConsentimiento | null | undefined;
  aceptarTodo: () => void;
  rechazarNoEsenciales: () => void;
  /** Vuelve a mostrar el banner para que el usuario pueda cambiar su decisión
   * (usado desde el link "Gestionar cookies" del footer y desde /cookies). */
  abrirPreferencias: () => void;
  preferenciasAbiertas: boolean;
  cerrarPreferencias: () => void;
};

const ConsentimientoContext = createContext<ConsentimientoContextValue | null>(null);

export function ConsentimientoProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoConsentimiento | null | undefined>(undefined);
  const [preferenciasAbiertas, setPreferenciasAbiertas] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEstado(leerConsentimiento());
  }, []);

  const decidir = useCallback((decision: DecisionConsentimiento) => {
    const nuevoEstado = guardarConsentimiento(decision);
    setEstado(nuevoEstado);
    setPreferenciasAbiertas(false);
  }, []);

  const aceptarTodo = useCallback(() => decidir("aceptado"), [decidir]);
  const rechazarNoEsenciales = useCallback(() => decidir("rechazado"), [decidir]);
  const abrirPreferencias = useCallback(() => setPreferenciasAbiertas(true), []);
  const cerrarPreferencias = useCallback(() => setPreferenciasAbiertas(false), []);

  const value = useMemo(
    () => ({
      estado,
      aceptarTodo,
      rechazarNoEsenciales,
      abrirPreferencias,
      preferenciasAbiertas,
      cerrarPreferencias,
    }),
    [estado, aceptarTodo, rechazarNoEsenciales, abrirPreferencias, preferenciasAbiertas, cerrarPreferencias]
  );

  return <ConsentimientoContext.Provider value={value}>{children}</ConsentimientoContext.Provider>;
}

export function useConsentimiento() {
  const ctx = useContext(ConsentimientoContext);
  if (!ctx) {
    throw new Error("useConsentimiento debe usarse dentro de <ConsentimientoProvider>");
  }
  return ctx;
}
