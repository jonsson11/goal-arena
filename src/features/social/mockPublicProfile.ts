import type { Amigo, EstadisticasPublicas } from "./type";
import { logros as logrosBase } from "@/features/profile/data";
import type { Logro } from "@/features/profile/type";

export function generarEstadisticasPublicas(amigo: Amigo): EstadisticasPublicas {
  return {
    partidasJugadas: amigo.nivel * 6,
    porcentajeAcierto: Math.min(95, 40 + amigo.nivel * 2),
    rachaMaxima: Math.min(30, amigo.nivel + 3),
  };
}

export function generarLogrosPublicos(amigo: Amigo): Logro[] {
  return logrosBase.map((logro, i) => ({
    ...logro,
    desbloqueado: amigo.nivel > i * 5,
  }));
}