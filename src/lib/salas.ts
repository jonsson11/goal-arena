// src/lib/salas.ts
//
// SOLO SERVIDOR. Helpers compartidos por las rutas de /api/salas/*.

import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import type { Sala, JuegoMultijugador } from "@/features/multijugador/type";
import type { Dificultad } from "@/features/games/shared/types";

// Sin 0/O, 1/I/L, ni vocales que formen palabras raras por accidente --
// alfabeto reducido a propósito para que un código se pueda leer en voz
// alta o escribir a mano sin ambigüedad ("¿esto es una O o un cero?").
const ALFABETO_CODIGO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const LONGITUD_CODIGO = 6;

function generarCodigoAlAzar(): string {
  let codigo = "";
  for (let i = 0; i < LONGITUD_CODIGO; i++) {
    codigo += ALFABETO_CODIGO[Math.floor(Math.random() * ALFABETO_CODIGO.length)];
  }
  return codigo;
}

// Reintenta si por casualidad choca con uno ya existente -- con 32^6 (~10^9)
// combinaciones posibles la colisión es rarísima, pero hay que cubrirla.
export async function generarCodigoSalaUnico(): Promise<string> {
  for (let intento = 0; intento < 10; intento++) {
    const codigo = generarCodigoAlAzar();
    const existente = await prisma.sala.findUnique({ where: { codigo } });
    if (!existente) return codigo;
  }
  throw new Error("No se pudo generar un código de sala único, inténtalo de nuevo.");
}

// Tipo de una Sala de Prisma con sus jugadores (y el User de cada uno) ya
// incluidos -- lo que devuelve prisma.sala.findUnique({ include: { jugadores:
// { include: { user: true } } } }). Definido aparte para no repetir el
// `include` en cada sitio que llama a serializarSala.
const INCLUDE_JUGADORES = {
  jugadores: { include: { user: true }, orderBy: { unidoEn: "asc" as const } },
} satisfies Prisma.SalaInclude;

type SalaConJugadores = Prisma.SalaGetPayload<{ include: typeof INCLUDE_JUGADORES }>;

export const SALA_INCLUDE_JUGADORES = INCLUDE_JUGADORES;

// Convierte la fila de Prisma (con jugadores) al tipo que consume el
// cliente -- una única fuente de verdad para esta conversión, usada por
// todas las rutas de /api/salas/* que devuelven el estado de una sala.
export function serializarSala(sala: SalaConJugadores): Sala {
  return {
    codigo: sala.codigo,
    juego: sala.juego as JuegoMultijugador,
    dificultad: (sala.dificultad as Dificultad | null) ?? null,
    maxJugadores: sala.maxJugadores,
    estado: sala.estado,
    creadorId: sala.creadorId,
    jugadores: sala.jugadores.map((sj) => ({
      id: sj.user.id,
      nombre: sj.user.nombre,
      avatar: sj.user.avatar,
      avatarTipo: sj.user.avatarTipo === "FOTO" ? ("foto" as const) : ("emoji" as const),
      listo: sj.listo,
      esCreador: sj.user.id === sala.creadorId,
    })),
  };
}