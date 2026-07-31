// scripts/equipos/fusionar-equipos-duplicados.ts
//
// Fusiona los grupos de equipos duplicados que detecta
// detectar-equipos-duplicados.ts (mismo nombre normalizado, ej.
// "Atlético Madrid" y "Club Atlético de Madrid") en una sola fila de
// Team, para que los Stint / PlayerStat / Player.equipoActual de un
// jugador no queden repartidos según qué variante del nombre le tocó
// entrar en concreto.
//
// Cada grupo se trata de una de estas tres formas:
//
// 1. GRUPO BASURA (ninguna fila es un club real -- ver `esNombreBasura`
//    más abajo, ej. "| clubnumber =", restos crudos del parseo del
//    infobox de Wikipedia que quedaron guardados como si fueran nombre
//    de equipo). Aquí no hay canónico que valga: se limpia en vez de
//    fusionar --  se borran los Stint que pudieran colgar de ahí (no
//    debería haber ninguno, pero por seguridad), se pone a null el
//    Player.equipoActual y el PlayerStat.teamId de quien apuntara aquí, y
//    se borran todas las filas del grupo. Mejor que un jugador se quede
//    sin equipoActual a que lo tenga apuntando a "| clubnumber =".
//
// 2. GRUPO CON externalId AMBIGUO (dos filas del grupo tienen cada una
//    su propio externalId, no nulo y distinto entre sí): NO se fusiona
//    automático, se lista aparte para revisar a mano -- podría ser una
//    señal de que en realidad son dos equipos distintos que el
//    emparejamiento por nombre ha juntado por error.
//
// 3. GRUPO NORMAL: se elige un equipo "canónico" (el que tenga escudo >
//    externalId > elegibleParaGrid > más Stint+PlayerStat+jugadores con
//    equipoActual, en ese orden de prioridad) y se reapuntan hacia él
//    todos los Stint / PlayerStat / Player.equipoActual de las demás
//    filas del grupo, que luego se borran. Si alguna fila no-canónica
//    tenía un externalId que el canónico no tiene, se hereda antes de
//    borrar (para no perder ese dato).
//
// Ejecutar con:
//   npx tsx scripts/equipos/fusionar-equipos-duplicados.ts             (dry-run, no escribe nada)
//   npx tsx scripts/equipos/fusionar-equipos-duplicados.ts --aplicar    (aplica los cambios de verdad)
//
// Requiere en .env: DATABASE_URL.
// Recomendado: haz un backup/snapshot de la BD en Supabase antes de
// ejecutar con --aplicar la primera vez, por si acaso.

import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { normalizarEquipo } from "../../src/lib/normalizacion/normalizarEquipo";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const APLICAR = process.argv.includes("--aplicar");

type EquipoFila = {
  id: string;
  nombre: string;
  escudo: string | null;
  externalId: string | null;
  elegibleParaGrid: boolean;
};

function puntuar(equipo: EquipoFila): number {
  return (equipo.escudo ? 4 : 0) + (equipo.externalId ? 2 : 0) + (equipo.elegibleParaGrid ? 1 : 0);
}

// Restos crudos de la plantilla de infobox de Wikipedia que se colaron
// como si fueran nombre de equipo, ej. "| clubnumber =", "|youthyears1 =
// 1988–1991" (ver claude/pendientes-goal-arena.md y la tarea pendiente
// de limpiar Team en el roadmap). Un club de verdad nunca empieza por
// "|" ni lleva un "=" suelto, así que sirve como detector barato sin
// necesitar una lista de nombres basura mantenida a mano.
function esNombreBasura(nombre: string): boolean {
  return /^\s*\|/.test(nombre) || nombre.includes("=");
}

async function main() {
  console.log(`Modo: ${APLICAR ? "APLICAR (escribe en la BD)" : "dry-run (no escribe nada)"}\n`);

  const equipos = await prisma.team.findMany({
    select: { id: true, nombre: true, escudo: true, externalId: true, elegibleParaGrid: true },
  });

  const grupos = new Map<string, EquipoFila[]>();
  for (const equipo of equipos) {
    const clave = normalizarEquipo(equipo.nombre);
    if (!clave) continue;
    const lista = grupos.get(clave) ?? [];
    lista.push(equipo);
    grupos.set(clave, lista);
  }

  const duplicados = [...grupos.entries()].filter(([, lista]) => lista.length > 1);

  if (duplicados.length === 0) {
    console.log("No hay equipos duplicados que fusionar. 🎉");
    await prisma.$disconnect();
    return;
  }

  let fusionados = 0;
  let gruposBasuraLimpiados = 0;
  let paraRevisarManual = 0;

  for (const [clave, lista] of duplicados) {
    const todosBasura = lista.every((e) => esNombreBasura(e.nombre));
    const algunoBasura = lista.some((e) => esNombreBasura(e.nombre));

    if (algunoBasura && !todosBasura) {
      // Mezcla rara: alguna fila del grupo parece basura y otra parece un
      // club real. No hay forma segura de adivinar automáticamente aquí.
      console.log(`⚠ "${clave}": mezcla de nombre(s) basura y de club real en el mismo grupo -- revisar a mano:`);
      lista.forEach((e) => console.log(`    id=${e.id} "${e.nombre}"`));
      console.log("");
      paraRevisarManual++;
      continue;
    }

    if (todosBasura) {
      const ids = lista.map((e) => e.id);
      const [stints, playerStats, equipoActualDe] = await Promise.all([
        prisma.stint.count({ where: { teamId: { in: ids } } }),
        prisma.playerStat.count({ where: { teamId: { in: ids } } }),
        prisma.player.count({ where: { equipoActualId: { in: ids } } }),
      ]);

      console.log(
        `🗑 "${clave}": ${lista.length} fila(s) de BASURA del scrapeo (no son clubes reales) -- se limpia en vez de fusionar.`
      );
      lista.forEach((e) => console.log(`    id=${e.id} "${e.nombre}"`));
      console.log(
        `    → se borrarán ${stints} stint(s) huérfano(s), se quitará el equipo de ${playerStats} playerStat(s) y de ${equipoActualDe} jugador(es) con equipoActual apuntando aquí`
      );

      if (APLICAR) {
        await prisma.$transaction([
          prisma.stint.deleteMany({ where: { teamId: { in: ids } } }),
          prisma.playerStat.updateMany({ where: { teamId: { in: ids } }, data: { teamId: null } }),
          prisma.player.updateMany({ where: { equipoActualId: { in: ids } }, data: { equipoActualId: null } }),
        ]);
        await prisma.team.deleteMany({ where: { id: { in: ids } } });
      }

      console.log("");
      gruposBasuraLimpiados++;
      continue;
    }

    const externalIdsDistintos = new Set(lista.map((e) => e.externalId).filter((v): v is string => !!v));

    if (externalIdsDistintos.size > 1) {
      console.log(
        `⚠ "${clave}": ${lista.length} filas con MÁS DE UN externalId distinto (${[...externalIdsDistintos].join(", ")}) -- no se fusiona automático, revisar a mano:`
      );
      lista.forEach((e) => console.log(`    id=${e.id} "${e.nombre}" externalId=${e.externalId ?? "—"}`));
      console.log("");
      paraRevisarManual++;
      continue;
    }

    // Peso de uso real (Stint + PlayerStat + jugadores con equipoActual),
    // para desempatar cuando ni escudo ni externalId ni elegibleParaGrid
    // deciden -- el que más tenga es el que más "cuesta" mover, así que
    // se queda como canónico y los demás se reapuntan hacia él.
    const conPeso = await Promise.all(
      lista.map(async (equipo) => {
        const [stints, playerStats, equipoActualDe] = await Promise.all([
          prisma.stint.count({ where: { teamId: equipo.id } }),
          prisma.playerStat.count({ where: { teamId: equipo.id } }),
          prisma.player.count({ where: { equipoActualId: equipo.id } }),
        ]);
        return { equipo, peso: stints + playerStats + equipoActualDe, stints, playerStats, equipoActualDe };
      })
    );

    conPeso.sort((a, b) => {
      const diferenciaPuntos = puntuar(b.equipo) - puntuar(a.equipo);
      if (diferenciaPuntos !== 0) return diferenciaPuntos;
      return b.peso - a.peso;
    });

    const [canonicoInfo, ...restoInfo] = conPeso;
    const canonico = canonicoInfo.equipo;

    console.log(`"${clave}": canónico = "${canonico.nombre}" (id=${canonico.id})`);

    const externalIdAHeredar = !canonico.externalId
      ? restoInfo.find((r) => r.equipo.externalId)?.equipo.externalId
      : undefined;

    for (const { equipo: dupe, stints, playerStats, equipoActualDe } of restoInfo) {
      console.log(
        `    ← fusiona "${dupe.nombre}" (id=${dupe.id}): ${stints} stint(s), ${playerStats} playerStat(s), ${equipoActualDe} jugador(es) con equipoActual`
      );

      if (APLICAR) {
        await prisma.$transaction([
          prisma.stint.updateMany({ where: { teamId: dupe.id }, data: { teamId: canonico.id } }),
          prisma.playerStat.updateMany({ where: { teamId: dupe.id }, data: { teamId: canonico.id } }),
          prisma.player.updateMany({ where: { equipoActualId: dupe.id }, data: { equipoActualId: canonico.id } }),
        ]);
        await prisma.team.delete({ where: { id: dupe.id } });
      }
    }

    if (APLICAR && externalIdAHeredar) {
      await prisma.team.update({ where: { id: canonico.id }, data: { externalId: externalIdAHeredar } });
      console.log(`    → externalId ${externalIdAHeredar} heredado por el canónico`);
    }

    console.log("");
    fusionados++;
  }

  console.log("=== Resumen ===");
  console.log(`Grupos fusionados${APLICAR ? "" : " (simulados, dry-run)"}: ${fusionados}`);
  console.log(`Grupos de basura limpiados${APLICAR ? "" : " (simulados, dry-run)"}: ${gruposBasuraLimpiados}`);
  if (paraRevisarManual > 0) {
    console.log(`Grupos que necesitan revisión manual: ${paraRevisarManual}`);
  }
  if (!APLICAR && fusionados + gruposBasuraLimpiados > 0) {
    console.log(`\nEsto ha sido un dry-run. Si el plan de arriba tiene buena pinta, vuelve a ejecutar con --aplicar.`);
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
