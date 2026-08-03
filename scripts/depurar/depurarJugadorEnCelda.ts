// scripts/depurar/depurarJugadorEnCelda.ts
//
// Diagnostica por qué un jugador concreto NO aparece como solución válida
// para una casilla equipo+nacionalidad del 3x3, reproduciendo EXACTAMENTE
// la misma lógica que construirIndice() / idsSolucionCelda() en
// src/features/games/grid/indiceEquipos.server.ts (mismo filtro
// esNombreValido, misma clave de agrupación por team.nombre en crudo, sin
// normalizar) -- así el resultado de este script es fiable: si aquí sale
// que el jugador SÍ cumple, el bug está en otra parte (front-end / caché
// del tablero ya generado); si sale que NO cumple, aquí mismo se ve el
// porqué exacto.
//
// Solo LEE, no escribe nada -- seguro de ejecutar tantas veces como haga
// falta.
//
// Ejecutar con:
//   npx tsx scripts/depurar/depurarJugadorEnCelda.ts "<nombre o parte del nombre del jugador>" "<equipo>" "<nacionalidad>"
//
// Ejemplo:
//   npx tsx scripts/depurar/depurarJugadorEnCelda.ts "Declan Rice" "Arsenal" "Inglaterra"
//
// Requiere en .env: DATABASE_URL.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizarEquipo, normalizar } from "../../src/lib/normalizacion/normalizarEquipo";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

// Copia exacta de PATRON_NOMBRE_INVALIDO/esNombreValido de
// src/features/games/grid/indiceEquipos.server.ts -- duplicada a propósito
// en vez de importada: ese archivo importa `@/lib/prisma` con el alias de
// tsconfig, que tsx no resuelve al ejecutar un script suelto (mismo motivo
// por el que el resto de scripts de esta carpeta usan imports relativos).
// Si cambia el patrón allí, hay que actualizarlo aquí también.
const PATRON_NOMBRE_INVALIDO =
  /\b(u-?\d{1,2}|sub-?\s?\d{1,2}|under-?\d{1,2}|olympic|youth|junior|jong|primavera|juvenil|cantera|filial|academ(y|ia)|reserves?|\bii\b|\bb\b)\b/i;

function esNombreValido(nombre: string): boolean {
  return !PATRON_NOMBRE_INVALIDO.test(nombre);
}

function marca(ok: boolean): string {
  return ok ? "✅" : "❌";
}

// Compara dos strings con distintos niveles de tolerancia, para separar
// "no es el mismo club/país en absoluto" de "es el mismo pero con
// mayúsculas/espacios/tildes distintas" (que apuntaría a un problema de
// normalización, no de datos ausentes).
function compararNiveles(a: string, b: string): { exacto: boolean; sinEspacios: boolean; normalizado: boolean } {
  return {
    exacto: a === b,
    sinEspacios: a.trim() === b.trim(),
    normalizado: normalizar(a) === normalizar(b),
  };
}

async function main() {
  const [nombreJugador, equipoBuscado, nacionalidadBuscada] = process.argv.slice(2);

  if (!nombreJugador || !equipoBuscado || !nacionalidadBuscada) {
    console.error(
      'Uso: npx tsx scripts/depurar/depurarJugadorEnCelda.ts "<nombre jugador>" "<equipo>" "<nacionalidad>"'
    );
    process.exit(1);
  }

  console.log(`\n=== Buscando jugadores que coincidan con "${nombreJugador}" ===`);

  const candidatos = await prisma.player.findMany({
    where: { nombre: { contains: nombreJugador, mode: "insensitive" } },
    include: { stints: { include: { team: true }, orderBy: { startDate: "asc" } } },
  });

  if (candidatos.length === 0) {
    console.log("Ningún jugador en la BD coincide con ese nombre. Revisa la ortografía.");
    await prisma.$disconnect();
    return;
  }

  console.log(`${candidatos.length} jugador(es) encontrado(s).\n`);

  for (const jugador of candidatos) {
    console.log(`--- ${jugador.nombre} (id=${jugador.id}) ---`);

    const nacOk = compararNiveles(jugador.nacionalidad, nacionalidadBuscada);
    console.log(
      `  Nacionalidad en BD: "${jugador.nacionalidad}"  vs buscada: "${nacionalidadBuscada}"  ` +
        `${marca(nacOk.exacto)} exacto  ${marca(nacOk.sinEspacios)} sin-espacios  ${marca(nacOk.normalizado)} normalizado`
    );
    if (!nacOk.exacto && nacOk.normalizado) {
      console.log(
        "  ⚠️  Es el mismo país pero el string no es IDÉNTICO -- construirIndice() agrupa por " +
          "player.nacionalidad EN CRUDO (sin normalizar), así que esto por sí solo ya haría que " +
          "no cuente para la columna del tablero."
      );
    }
    const nacionalidadValidaSegunFiltro =
      !!jugador.nacionalidad && jugador.nacionalidad !== "Desconocida" && esNombreValido(jugador.nacionalidad);
    if (!nacionalidadValidaSegunFiltro) {
      console.log(
        `  ⚠️  esNombreValido()/filtro de nacionalidad la RECHAZA (vacía, "Desconocida", o coincide con ` +
          `el patrón de categorías juveniles/reservas) -- este jugador nunca cuenta para NINGUNA columna de nacionalidad.`
      );
    }

    if (jugador.stints.length === 0) {
      console.log("  (sin etapas registradas -- no pertenece a ningún equipo, por tanto no puede salir en el grid)");
    }

    let algunaEtapaCoincideEquipo = false;

    for (const stint of jugador.stints) {
      const nombreEquipo = stint.team.nombre;
      const pasaFiltroNombre = esNombreValido(nombreEquipo);
      const eqOk = compararNiveles(nombreEquipo, equipoBuscado);

      const etiquetas: string[] = [];
      if (eqOk.exacto) etiquetas.push("MATCH EXACTO");
      else if (eqOk.normalizado) etiquetas.push("mismo club, string distinto (posible duplicado)");
      if (!pasaFiltroNombre) etiquetas.push("EXCLUIDO por esNombreValido (patrón de cantera/reservas/juvenil)");
      if (!stint.team.elegibleParaGrid) etiquetas.push("team.elegibleParaGrid=false (no afecta a validez de respuesta, solo a generación)");

      console.log(
        `  • Etapa: "${nombreEquipo}" (teamId=${stint.teamId}, país=${stint.team.pais})` +
          (etiquetas.length ? `  [${etiquetas.join(" · ")}]` : "")
      );

      if (eqOk.exacto && pasaFiltroNombre) algunaEtapaCoincideEquipo = true;
    }

    const contariaComoSolucion = algunaEtapaCoincideEquipo && nacionalidadValidaSegunFiltro && nacOk.exacto;
    console.log(
      `\n  ${marca(contariaComoSolucion)} ¿Cuenta como solución válida para equipo="${equipoBuscado}" + nacionalidad="${nacionalidadBuscada}" con la lógica real del generador?\n`
    );
  }

  // Si ninguna etapa dio match exacto, busca si existe algún OTRO Team con
  // nombre parecido (normalizado) al buscado -- el caso típico de
  // duplicados detectado ya por detectarEquiposDuplicados.ts.
  console.log(`=== Equipos en BD cuyo nombre normalizado coincide con "${equipoBuscado}" ===`);
  const claveBuscada = normalizarEquipo(equipoBuscado);
  const todosLosEquipos = await prisma.team.findMany({
    select: { id: true, nombre: true, elegibleParaGrid: true },
  });
  const equiposParecidos = todosLosEquipos.filter((e) => normalizarEquipo(e.nombre) === claveBuscada);

  if (equiposParecidos.length === 0) {
    console.log(`Ningún equipo en la BD normaliza a "${claveBuscada}". Revisa el nombre exacto usado en el tablero.`);
  } else {
    for (const e of equiposParecidos) {
      const stintsDeEsteEquipo = await prisma.stint.count({ where: { teamId: e.id } });
      console.log(
        `  id=${e.id}  "${e.nombre}"  elegibleParaGrid=${e.elegibleParaGrid}  stints=${stintsDeEsteEquipo}` +
          (e.nombre !== equipoBuscado ? "  ⚠️  nombre distinto al buscado -- posible duplicado" : "")
      );
    }
    if (equiposParecidos.length > 1) {
      console.log(
        "\n  ⚠️  Hay más de un Team para el mismo club real. Si el jugador tiene su Stint en uno y el " +
          "tablero generó la fila/columna con el nombre del otro, por eso no cuenta -- son dos claves " +
          "distintas en jugadoresPorEquipo. Solución: fusionar con scripts/equipos/fusionar-equipos-duplicados.ts."
      );
    }
  }

  console.log();
  await prisma.$disconnect();
}

main().catch(async (e: unknown) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});