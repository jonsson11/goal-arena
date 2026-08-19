// src/features/cookies/consentimiento.ts
//
// Estado de consentimiento de cookies, sin ninguna librería externa (CMP)
// de momento -- para un sitio con solo AdSense (sin analítica propia
// todavía) no hace falta nada más sofisticado. Si en el futuro se añade
// Google Analytics u otro proveedor con cookies "no esenciales" propias,
// este es el sitio donde ampliar las categorías.
//
// Diseño: un único valor guardado en localStorage, no una cookie de
// verdad -- todo lo que condiciona (banner visible o no, si se carga el
// script de AdSense) pasa en el cliente, así que no hace falta que el
// servidor lo lea. Se guarda también la fecha de la decisión para poder,
// en el futuro, volver a preguntar pasado un tiempo (p. ej. 12 meses) sin
// tener que tocar la lógica que la lee.

export type DecisionConsentimiento = "aceptado" | "rechazado";

export type EstadoConsentimiento = {
  decision: DecisionConsentimiento;
  fecha: string; // ISO -- informativo, no se usa todavía para caducar la decisión
};

const CLAVE_LOCALSTORAGE = "goalarena_consentimiento_cookies";

// Si se cambia de forma incompatible lo que se guarda, subir esta versión
// invalida cualquier decisión antigua guardada en el navegador del
// usuario y se le vuelve a preguntar.
const VERSION_CONSENTIMIENTO = 1;

type ConsentimientoGuardado = EstadoConsentimiento & { version: number };

export function leerConsentimiento(): EstadoConsentimiento | null {
  if (typeof window === "undefined") return null;

  try {
    const bruto = window.localStorage.getItem(CLAVE_LOCALSTORAGE);
    if (!bruto) return null;

    const datos = JSON.parse(bruto) as ConsentimientoGuardado;
    if (datos.version !== VERSION_CONSENTIMIENTO) return null;
    if (datos.decision !== "aceptado" && datos.decision !== "rechazado") return null;

    return { decision: datos.decision, fecha: datos.fecha };
  } catch {
    // localStorage corrupto o inaccesible (modo privado estricto en algún
    // navegador) -- se trata como "todavía no ha decidido", nunca como error.
    return null;
  }
}

export function guardarConsentimiento(decision: DecisionConsentimiento): EstadoConsentimiento {
  const estado: EstadoConsentimiento = { decision, fecha: new Date().toISOString() };

  if (typeof window !== "undefined") {
    try {
      const datosAGuardar: ConsentimientoGuardado = { ...estado, version: VERSION_CONSENTIMIENTO };
      window.localStorage.setItem(CLAVE_LOCALSTORAGE, JSON.stringify(datosAGuardar));
    } catch {
      // Si no se puede guardar (localStorage lleno/bloqueado), no rompemos
      // nada -- simplemente se le volverá a preguntar la próxima visita.
    }
  }

  return estado;
}

export function borrarConsentimiento(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(CLAVE_LOCALSTORAGE);
  } catch {
    // ver nota de arriba
  }
}
