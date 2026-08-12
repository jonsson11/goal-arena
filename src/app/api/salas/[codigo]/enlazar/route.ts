// src/app/api/salas/[codigo]/enlazar/route.ts
//
// POST { jugador } -> intenta añadir `jugador` a MI cadena (cada jugador
// de la sala construye su propia cadena hacia el mismo jugadorInicial/
// jugadorFinal de forma independiente, igual que GRID resuelve el mismo
// tablero -- ver comentario de SalaJugador.progreso en el schema). El
// servidor es quien decide si el paso es válido (mismo
// verificarConexion que ya usa el modo individual, ver
// grafoJugadores.server.ts) y si con este paso la cadena ya llega al
// final -- el cliente nunca ve el grafo completo, solo intenta un
// jugador cada vez.
//
// Mismo mecanismo de cierre en servidor (finalizarPartidaSiToca) que ya
// usan .../colocar (GRID) y .../acertar (TOP10), para el caso de que se
// acabe el tiempo sin que nadie complete su cadena.

import { NextResponse } from "next/server";
import { crearClienteSupabaseServidor } from "@/lib/supabase/server";
import { prisma } from "@/lib/prisma";
import { verificarConexion } from "@/features/games/linkplayers/grafoJugadores.server";
import { finalizarPartidaSiToca, construirEstadoPartida } from "@/lib/salas";
import type { PartidaGenerada, PasoCadena, PistaEtapa } from "@/features/games/linkplayers/type";
import type { Equipo, Jugador } from "@/features/games/shared/types";

export const dynamic = "force-dynamic";

async function usuarioActual() {
  const supabase = await crearClienteSupabaseServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

function jugadorValido(valor: unknown): valor is Jugador {
  if (!valor || typeof valor !== "object") return false;
  const j = valor as Record<string, unknown>;
  return typeof j.nombre === "string" && Array.isArray(j.equipos) && typeof j.nacionalidad === "string";
}

// Mismo criterio que pistasDeEquipos en LinkPlayersGame.tsx (modo
// individual): las etapas de un candidato del buscador (Equipo, con
// desde/hasta/cedido ya calculados por /api/jugadores/buscar) al formato
// PistaEtapa que espera el desplegable "Carrera" -- duplicado a propósito
// (es una función de tres líneas) en vez de compartir un import entre un
// componente cliente y una ruta de servidor.
function pistasDeEquipos(equipos: Equipo[]): PistaEtapa[] {
  return equipos.map((equipo) => ({
    equipo: equipo.nombre,
    temporada: equipo.desde ? `${equipo.desde} - ${equipo.hasta ?? "actualidad"}` : undefined,
    cedido: equipo.cedido,
  }));
}

export async function POST(request: Request, { params }: { params: Promise<{ codigo: string }> }) {
  const user = await usuarioActual();
  if (!user) {
    return NextResponse.json({ error: "No has iniciado sesión." }, { status: 401 });
  }

  const { codigo } = await params;

  let body: { jugador?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  if (!jugadorValido(body.jugador)) {
    return NextResponse.json({ error: "Petición inválida." }, { status: 400 });
  }

  const sala = await prisma.sala.findUnique({
    where: { codigo: codigo.toUpperCase() },
    include: { jugadores: true },
  });
  if (!sala) {
    return NextResponse.json({ error: "Esa sala no existe." }, { status: 404 });
  }
  if (sala.juego !== "LINKPLAYERS") {
    return NextResponse.json({ error: "Esta sala no es de LinkPlayers." }, { status: 400 });
  }
  if (sala.estado !== "EN_CURSO") {
    return NextResponse.json({ error: "Esta partida no está en curso." }, { status: 400 });
  }

  const mi = sala.jugadores.find((sj) => sj.userId === user.id);
  if (!mi) {
    return NextResponse.json({ error: "No estás en esa sala." }, { status: 403 });
  }

  // Misma guarda extra que .../colocar y .../acertar: si el timer ya
  // venció pero nadie ha hecho polling todavía para cerrar la partida, se
  // cierra ya mismo.
  if (
    sala.empezadaEn &&
    sala.duracionSegundos &&
    Date.now() >= sala.empezadaEn.getTime() + sala.duracionSegundos * 1000
  ) {
    await finalizarPartidaSiToca(sala.id);
    return NextResponse.json({ error: "Se ha acabado el tiempo." }, { status: 400 });
  }

  // Misma guarda simétrica que .../colocar y .../acertar: todavía
  // esperando a que todos carguen la pantalla de partida (`empezadaEn`
  // sigue en null) o todavía en la cuenta atrás 3-2-1.
  if (!sala.empezadaEn || Date.now() < sala.empezadaEn.getTime()) {
    return NextResponse.json({ error: "La partida todavía no ha empezado." }, { status: 400 });
  }

  if (mi.terminadaEn) {
    return NextResponse.json({ error: "Ya has completado tu cadena." }, { status: 400 });
  }

  const contenido = sala.contenido as unknown as PartidaGenerada;
  // El progreso guarda la cadena SIN el jugador inicial (igual que GRID
  // guarda solo lo que YO he colocado) -- se antepone `jugadorInicial`
  // solo al leer, ver construirEstadoPartida.
  const progreso = (mi.progreso as unknown as PasoCadena[]) ?? [];
  const nombresEnCadena = [contenido.jugadorInicial.nombre, ...progreso.map((p) => p.jugador.nombre)];

  if (nombresEnCadena.includes(body.jugador.nombre)) {
    return NextResponse.json({ error: `${body.jugador.nombre} ya está en tu cadena.` }, { status: 400 });
  }

  const ultimoNombre = progreso.length > 0 ? progreso[progreso.length - 1].jugador.nombre : contenido.jugadorInicial.nombre;

  const resultado = await verificarConexion(ultimoNombre, body.jugador.nombre);
  if (!resultado.conectados) {
    return NextResponse.json(
      { error: `${ultimoNombre} y ${body.jugador.nombre} no coincidieron nunca en un club.` },
      { status: 400 }
    );
  }

  const nuevoPaso: PasoCadena = {
    jugador: {
      nombre: body.jugador.nombre,
      nacionalidad: body.jugador.nacionalidad,
      imagenUrl: body.jugador.imagenUrl,
      pistas: pistasDeEquipos(body.jugador.equipos),
    },
    conexion: { equipo: resultado.equipoComun!, temporada: resultado.temporada! },
  };
  let nuevoProgreso: PasoCadena[] = [...progreso, nuevoPaso];

  // Mismo automatismo que el modo individual (manejarSeleccion en
  // LinkPlayersGame.tsx, petición del usuario 11/08/2026): no hace falta
  // que busque y coloque él mismo al jugador final -- tras cada jugador
  // intermedio válido, se comprueba solo si YA conecta directamente con
  // el final, y si es así se añade automáticamente y se cierra la cadena.
  let gano = body.jugador.nombre === contenido.jugadorFinal.nombre;
  if (!gano) {
    const resultadoFinal = await verificarConexion(body.jugador.nombre, contenido.jugadorFinal.nombre);
    if (resultadoFinal.conectados) {
      nuevoProgreso = [
        ...nuevoProgreso,
        {
          jugador: contenido.jugadorFinal,
          conexion: { equipo: resultadoFinal.equipoComun!, temporada: resultadoFinal.temporada! },
        },
      ];
      gano = true;
    }
  }

  await prisma.salaJugador.update({
    where: { id: mi.id },
    data: {
      progreso: nuevoProgreso,
      celdasResueltas: nuevoProgreso.length,
      ...(gano ? { terminadaEn: new Date() } : {}),
    },
  });

  // Si acabo de completar la cadena, la partida se cierra AHORA MISMO --
  // mismo criterio que GRID/TOP10, no hace falta esperar al siguiente
  // polling de nadie.
  if (gano) {
    await finalizarPartidaSiToca(sala.id);
  }

  const estado = await construirEstadoPartida(sala.id, user.id);
  return NextResponse.json(estado);
}