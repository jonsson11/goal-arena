// src/app/api/perfil/estadisticas/route.ts
//
// GET -> estadísticas reales del usuario con sesión activa: partidas
// jugadas y % de victoria, en total, por JUEGO nada más (LinkPlayers,
// 3x3 Grid, Top10 -- independientemente del nivel, 12/08/2026, petición
// del usuario) y por modalidad (Un jugador / Multijugador de cada
// juego -- 12/08/2026, 2ª ronda, ver más abajo), más las últimas
// partidas jugadas para el historial del perfil.
//
// Todo sale de PartidaJugada -- los contadores denormalizados en User
// (partidasJugadas, rachaActual, rachaMaxima) siguen sirviendo para la
// carga rápida del nivel (ver /api/auth/me), pero el desglose por
// juego/modalidad necesita agrupar, así que aquí sí se consulta la tabla
// de verdad.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";

const ETIQUETA_JUEGO: Record<string, string> = {
  GRID: "3x3 Grid",
  TOP10: "Top 10",
  LINKPLAYERS: "LinkPlayers",
};

// Etiqueta de dificultad por juego -- misma redacción que ve el usuario en
// el selector de dificultad de cada juego (ver OPCIONES_DIFICULTAD en
// GameLauncher.tsx para GRID, y OPCIONES_DIFICULTAD_LINKPLAYERS en
// app/jugar/linkplayers/page.tsx para LinkPlayers) para que el historial
// no "invente" un texto distinto al que el usuario ya reconoce del menú
// de creación de partida (12/08/2026, petición del usuario: "tiene que
// poner lo mismo que en el menú"). TOP10 no tiene dificultad, por eso no
// tiene entrada aquí.
const ETIQUETA_DIFICULTAD: Record<string, Record<string, string>> = {
  GRID: { facil: "Fácil", medio: "Medio", dificil: "Difícil" },
  LINKPLAYERS: {
    facil: "1-2 jugadores intermedios",
    medio: "3-4 jugadores intermedios",
    dificil: "5-7 jugadores intermedios",
  },
};

// El multijugador (ver finalizarPartidaSiToca en salas.ts) registra sus
// partidas con el campo `modo` marcado -- "<dificultad>-online" en GRID
// (p. ej. "facil-online"), y directamente "online" en TOP10 (que no tiene
// dificultad). Antes solo se comprobaba el sufijo "-online" (ver
// calcularContadores en progresoLogros.ts), lo que dejaba fuera el caso
// "online" a secas de TOP10 -- aquí se comprueban los dos casos.
function esModoOnline(modo: string | null): boolean {
  return modo === "online" || (modo?.endsWith("-online") ?? false);
}

// Quita el sufijo de multijugador de `modo` y deja solo la dificultad
// (o null si no la había -- TOP10, o una partida antigua sin `modo`).
function dificultadDeModo(modo: string | null): string | null {
  if (!modo) return null;
  const sinSufijo = modo.replace(/-?online$/, "");
  return sinSufijo || null;
}

// Etiqueta legible de una partida para el historial: "<Juego>" +
// " · <Dificultad>" si aplica + " (Multijugador)" si se jugó en una sala
// (12/08/2026, 2ª ronda -- antes era una tabla fija de "juego:modo" ->
// texto que no cubría todas las combinaciones reales y se veía la clave
// en bruto, p. ej. "GRID:facil-online" o "TOP10:online", cuando aparecía
// una partida de multijugador).
function etiquetaPartida(juego: string, modo: string | null): string {
  const base = ETIQUETA_JUEGO[juego] ?? juego;
  const dificultad = dificultadDeModo(modo);
  const etiquetaDificultad = dificultad ? ETIQUETA_DIFICULTAD[juego]?.[dificultad] : undefined;

  let etiqueta = base;
  if (etiquetaDificultad) etiqueta += ` · ${etiquetaDificultad}`;
  if (esModoOnline(modo)) etiqueta += " (Multijugador)";
  return etiqueta;
}

const LIMITE_HISTORIAL = 8;

export async function GET() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const [agrupado, recientes, perfil] = await Promise.all([
    prisma.partidaJugada.groupBy({
      by: ["juego", "modo", "resultado"],
      where: { userId: user.id },
      _count: { _all: true },
    }),
    prisma.partidaJugada.findMany({
      where: { userId: user.id },
      orderBy: { jugadaEn: "desc" },
      take: LIMITE_HISTORIAL,
      select: { id: true, juego: true, modo: true, resultado: true, expGanada: true, jugadaEn: true },
    }),
    // rachaActual/rachaMaxima no se pueden sacar de un groupBy (son sobre
    // el ORDEN de las partidas, no un conteo) -- se mantienen aparte, en
    // User, actualizadas por POST /api/partidas en cada partida.
    prisma.user.findUnique({
      where: { id: user.id },
      select: { rachaActual: true, rachaMaxima: true },
    }),
  ]);

  // agrupado trae una fila por (juego, modo, resultado) -- se combinan en
  // tres acumulados distintos a la vez: por JUEGO nada más (porJuego), por
  // (juego, Un jugador/Multijugador) sin desglosar dificultad (porModalidad,
  // 12/08/2026 2ª ronda -- antes era por (juego, dificultad exacta), que
  // el usuario vio "feo" y demasiado fragmentado: "quiero Grid Un jugador,
  // Grid Multijugador, y así con todos los juegos"), y el acumulado total.
  type Acumulado = { jugadas: number; victorias: number };
  const porJuego = new Map<string, Acumulado>();
  const porModalidad = new Map<string, Acumulado>();
  const total: Acumulado = { jugadas: 0, victorias: 0 };

  function sumar(mapa: Map<string, Acumulado>, clave: string, jugadas: number, victorias: number) {
    const entrada = mapa.get(clave) ?? { jugadas: 0, victorias: 0 };
    entrada.jugadas += jugadas;
    entrada.victorias += victorias;
    mapa.set(clave, entrada);
  }

  for (const fila of agrupado) {
    const jugadas = fila._count._all;
    const victorias = fila.resultado === "VICTORIA" ? jugadas : 0;

    sumar(porJuego, fila.juego, jugadas, victorias);

    const claveModalidad = `${fila.juego}:${esModoOnline(fila.modo) ? "online" : "solo"}`;
    sumar(porModalidad, claveModalidad, jugadas, victorias);

    total.jugadas += jugadas;
    total.victorias += victorias;
  }

  function porcentaje(a: Acumulado): number {
    return a.jugadas === 0 ? 0 : Math.round((a.victorias / a.jugadas) * 100);
  }

  // Orden fijo (no por partidas jugadas) para que las tarjetas no salten
  // de sitio partida a partida -- mismo criterio que el resto de listados
  // de juegos (ver juegos.ts), salvo por el orden en sí: "por juego" sigue
  // el orden de juegos.ts (LinkPlayers primero), pero "por modo" sigue el
  // orden que pidió el usuario para que la rejilla de 3 columnas quede
  // cuadrada por filas (3x3 Grid / LinkPlayers / Top10 en cada fila, Un
  // jugador arriba y Multijugador debajo). Solo "por juego" descarta los
  // juegos sin ninguna partida -- "por modo" (ver más abajo) los enseña
  // igualmente, en blanco.
  const ORDEN_JUEGOS = ["LINKPLAYERS", "GRID", "TOP10"];
  const ORDEN_JUEGOS_MODO = ["GRID", "LINKPLAYERS", "TOP10"];

  const porJuegoOrdenado = ORDEN_JUEGOS.filter((juego) => porJuego.has(juego)).map((juego) => {
    const datos = porJuego.get(juego)!;
    return {
      clave: juego,
      etiqueta: ETIQUETA_JUEGO[juego] ?? juego,
      partidasJugadas: datos.jugadas,
      porcentajeVictoria: porcentaje(datos),
    };
  });

  // "Por modo" (12/08/2026, 3ª ronda): a diferencia de porJuego, aquí SÍ
  // se enseñan las 6 combinaciones (3 juegos x Un jugador/Multijugador)
  // aunque no tengan ninguna partida todavía -- petición explícita del
  // usuario, "que aparezcan todos los modos... si no se ha registrado
  // ninguna partida que ponga Sin partidas" -- así la rejilla siempre
  // sale cuadrada en vez de reordenarse según lo que ya se ha jugado.
  // `datos` es undefined en las combinaciones sin partidas; `porcentaje`
  // ya devuelve 0 con jugadas=0, así que basta con el fallback de abajo.
  const porModoOrdenado = ["solo", "online"].flatMap((modalidad) =>
    ORDEN_JUEGOS_MODO.map((juego) => {
      const datos = porModalidad.get(`${juego}:${modalidad}`) ?? { jugadas: 0, victorias: 0 };
      return {
        clave: `${juego}:${modalidad}`,
        etiqueta: `${ETIQUETA_JUEGO[juego] ?? juego} · ${modalidad === "online" ? "Multijugador" : "Un jugador"}`,
        partidasJugadas: datos.jugadas,
        porcentajeVictoria: porcentaje(datos),
      };
    })
  );

  return NextResponse.json({
    total: {
      partidasJugadas: total.jugadas,
      porcentajeVictoria: porcentaje(total),
    },
    rachaActual: perfil?.rachaActual ?? 0,
    rachaMaxima: perfil?.rachaMaxima ?? 0,
    porJuego: porJuegoOrdenado,
    porModo: porModoOrdenado,
    historial: recientes.map((p) => ({
      id: p.id,
      juego: p.juego,
      modo: p.modo,
      etiqueta: etiquetaPartida(p.juego, p.modo),
      resultado: p.resultado === "VICTORIA" ? "victoria" : "derrota",
      expGanada: p.expGanada,
      fecha: p.jugadaEn,
    })),
  });
}