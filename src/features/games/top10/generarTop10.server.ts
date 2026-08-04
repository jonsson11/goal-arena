// src/features/games/top10/generarTop10.server.ts
//
// SOLO SERVIDOR. No importar desde componentes "use client".

import { prisma } from "@/lib/prisma";
import type { RankingTop10 } from "./type";

/**
 * Devuelve un Top10Ranking al azar de los marcados como activos.
 *
 * @param excluirId  id del ranking que acaba de jugarse, para no repetirlo
 *                   dos veces seguidas (si es el único que hay, se repite).
 */
export async function generarTop10DesdeBD(excluirId?: string): Promise<RankingTop10> {
  const candidatos = await prisma.top10Ranking.findMany({
    where: { activo: true },
    select: { id: true },
  });

  if (candidatos.length === 0) {
    throw new Error(
      "No hay ningún Top 10 disponible todavía. Ejecuta scripts/jugadores/sync-top-scorers.ts para crear alguno."
    );
  }

  // Si hay más de uno, se evita repetir el de la partida anterior
  const elegibles =
    candidatos.length > 1 && excluirId
      ? candidatos.filter((c) => c.id !== excluirId)
      : candidatos;

  const pool = elegibles.length > 0 ? elegibles : candidatos;
  const elegido = pool[Math.floor(Math.random() * pool.length)];

  const ranking = await prisma.top10Ranking.findUnique({
    where: { id: elegido.id },
    select: {
      id: true,
      titulo: true,
      descripcion: true,
      entradas: {
        orderBy: { posicion: "asc" },
        select: {
          posicion: true,
          valor: true,
          valorTexto: true,
          player: { select: { nombre: true, nacionalidad: true } },
        },
      },
    },
  });

  if (!ranking || ranking.entradas.length === 0) {
    throw new Error("El Top 10 seleccionado no tiene entradas.");
  }

  return {
    id: ranking.id,
    titulo: ranking.titulo,
    descripcion: ranking.descripcion ?? undefined,
    respuestas: ranking.entradas.map((e) => ({
      nombre: e.player.nombre,
      nacionalidad: e.player.nacionalidad,
      valor: e.valor,
      valorTexto: e.valorTexto ?? undefined,
    })),
  };
}