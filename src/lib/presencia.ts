// src/lib/presencia.ts
//
// "¿Está conectado?" aproximado por actividad reciente (no es presencia en
// tiempo real): el navegador manda un heartbeat a /api/heartbeat cada
// minuto mientras hay sesión y la pestaña está abierta (ver AuthContext).
// Si la última vez que se recibió uno fue hace poco, se considera
// "conectado".

const MINUTOS_PARA_CONSIDERAR_CONECTADO = 2;

export function estaConectado(ultimaActividad: Date | null): boolean {
  if (!ultimaActividad) return false;
  const minutosDesde = (Date.now() - ultimaActividad.getTime()) / 1000 / 60;
  return minutosDesde <= MINUTOS_PARA_CONSIDERAR_CONECTADO;
}
