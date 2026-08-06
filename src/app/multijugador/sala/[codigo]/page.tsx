"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Crown, UserPlus } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { AuthGate } from "@/features/auth/AuthGate";
import { GameButton } from "@/features/games/shared/GameButton";
import { ConfirmDialog } from "@/features/games/shared/ConfirmDialog";
import type { Sala } from "@/features/multijugador/type";
import { TituloPagina } from "@/components/layout/TituloPagina";


const INTERVALO_POLLING_MS = 2500;

const ETIQUETA_DIFICULTAD: Record<string, string> = {
  facil: "Fácil",
  medio: "Medio",
  dificil: "Difícil",
};

const ETIQUETA_JUEGO: Record<string, string> = {
  GRID: "3x3 Grid",
  TOP10: "Top 10",
};

function AvatarJugador({ avatar, avatarTipo, nombre }: Sala["jugadores"][number]) {
  if (avatarTipo === "foto") {
    // eslint-disable-next-line @next/next/no-img-element -- foto de perfil de otro usuario (URL de Supabase Storage)
    return <img src={avatar} alt={nombre} className="h-11 w-11 shrink-0 rounded-full border border-border object-cover" />;
  }
  return (
    <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xl">
      {avatar}
    </div>
  );
}

export default function SalaEsperaPage({ params }: { params: Promise<{ codigo: string }> }) {
  const { codigo } = use(params);
  const { usuario } = useAuth();
  const router = useRouter();

  const [sala, setSala] = useState<Sala | null>(null);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(true);
  const [copiado, setCopiado] = useState(false);
  const [confirmandoSalida, setConfirmandoSalida] = useState(false);
  const [empezando, setEmpezando] = useState(false);
  const [marcandoListo, setMarcandoListo] = useState(false);
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<Set<string>>(new Set());
  const [enviandoSolicitudA, setEnviandoSolicitudA] = useState<string | null>(null);

  const activoRef = useRef(true);

  useEffect(() => {
    if (!usuario) return;
    activoRef.current = true;

    async function consultar() {
      try {
        const res = await fetch(`/api/salas/${codigo}`);
        const datos = await res.json();
        if (!activoRef.current) return;

        if (!res.ok) {
          setError(datos.error ?? "No se pudo cargar la sala.");
          setCargando(false);
          return;
        }

        setSala(datos as Sala);
        setCargando(false);

        if (datos.estado === "EN_CURSO") {
          activoRef.current = false;
          router.replace(`/multijugador/sala/${codigo}/partida`);
        } else if (datos.estado === "CANCELADA" || datos.estado === "FINALIZADA") {
          activoRef.current = false;
          setError("Esta sala ya no está disponible.");
        }
      } catch {
        if (activoRef.current) setError("No se pudo conectar con el servidor.");
      }
    }

    consultar();
    const intervalo = setInterval(consultar, INTERVALO_POLLING_MS);
    return () => {
      activoRef.current = false;
      clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codigo, usuario]);

  if (!usuario) {
    return (
      <AuthGate
        icono="🎮"
        titulo="Juega con tus amigos"
        descripcion="Inicia sesión para entrar en esta sala."
        redirectTras={`/multijugador/sala/${codigo}`}
        aspectos={["🎮 Salas de 2 a 8", "⏱️ Mismo reto, en directo"]}
      />
    );
  }

  async function alternarListo() {
    setMarcandoListo(true);
    try {
      const res = await fetch(`/api/salas/${codigo}/listo`, { method: "POST" });
      const datos = await res.json();
      if (res.ok) setSala(datos as Sala);
    } finally {
      setMarcandoListo(false);
    }
  }

  async function empezarPartida() {
    setEmpezando(true);
    setError("");
    try {
      const res = await fetch(`/api/salas/${codigo}/empezar`, { method: "POST" });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo empezar la partida.");
        return;
      }
      router.replace(`/multijugador/sala/${codigo}/partida`);
    } finally {
      setEmpezando(false);
    }
  }

  async function salirDeLaSala() {
    activoRef.current = false;
    await fetch(`/api/salas/${codigo}/salir`, { method: "POST" });
    router.push("/multijugador");
  }

  function copiarCodigo() {
    navigator.clipboard.writeText(codigo).then(() => {
      setCopiado(true);
      setTimeout(() => setCopiado(false), 1500);
    });
  }

  async function enviarSolicitudAmistad(jugador: Sala["jugadores"][number]) {
    setEnviandoSolicitudA(jugador.id);
    try {
      const res = await fetch("/api/amigos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nombreUsuario: jugador.nombre }),
      });
      if (res.ok) {
        setSolicitudesEnviadas((actuales) => new Set(actuales).add(jugador.id));
      }
    } finally {
      setEnviandoSolicitudA(null);
    }
  }

  if (cargando) {
    return (
      <div className="flex flex-col items-center gap-3 px-6 py-20 text-center">
        <p className="text-sm text-muted-foreground">Cargando sala...</p>
      </div>
    );
  }

  if (error && !sala) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-20 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <GameButton onClick={() => router.push("/multijugador")}>Volver a Multijugador</GameButton>
      </div>
    );
  }

  if (!sala) return null;

  const esCreador = sala.creadorId === usuario.id;
  const miFila = sala.jugadores.find((j) => j.id === usuario.id);
  const todosListos = sala.jugadores.every((j) => j.listo);
  const puedeEmpezar = esCreador && sala.jugadores.length >= 2 && todosListos;
  const salaLlena = sala.jugadores.length >= sala.maxJugadores;

  return (
    <div className="px-6 pb-14 pt-8 sm:pt-10">
      <div className="mx-auto flex max-w-lg flex-col items-center gap-8">
        <div className="flex flex-col items-center gap-2 text-center">
          <span className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
            Sala de espera
          </span>
          <TituloPagina acento="azul">
            {ETIQUETA_JUEGO[sala.juego] ?? sala.juego}
            {sala.dificultad && (
              <span className="ml-2 bg-none text-lg font-semibold text-muted-foreground">
                · {ETIQUETA_DIFICULTAD[sala.dificultad]}
              </span>
            )}
          </TituloPagina>
        </div>

        <button
          onClick={copiarCodigo}
          className="flex items-center gap-3 rounded-2xl border border-primary/40 bg-primary/10 px-6 py-4 backdrop-blur-md transition-colors hover:bg-primary/15"
        >
          <span className="text-3xl font-extrabold tracking-[0.3em] text-primary">{sala.codigo}</span>
          {copiado ? <Check className="h-5 w-5 text-primary" /> : <Copy className="h-5 w-5 text-primary/70" />}
        </button>
        <p className="-mt-6 text-xs text-muted-foreground">
          {copiado ? "¡Copiado!" : "Toca para copiar el código"}
        </p>

        <div className="flex w-full flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">
              Jugadores ({sala.jugadores.length}/{sala.maxJugadores})
            </span>
            {salaLlena && <span className="text-xs font-semibold text-muted-foreground">Sala llena</span>}
          </div>

          <div className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60 bg-card/40 backdrop-blur-md">
            {sala.jugadores.map((jugador) => {
              const puedeAñadir =
                jugador.amistad !== "AMIGOS" &&
                jugador.amistad !== "PENDIENTE" &&
                jugador.amistad !== "YO" &&
                !solicitudesEnviadas.has(jugador.id);

              return (
                <div key={jugador.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <AvatarJugador {...jugador} />
                    <div className="flex min-w-0 items-center gap-1.5">
                      <span className="truncate text-sm font-semibold text-foreground">{jugador.nombre}</span>
                      {jugador.esCreador && <Crown className="h-3.5 w-3.5 shrink-0 text-[#D4AF37]" />}
                    </div>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {puedeAñadir && (
                      <button
                        onClick={() => enviarSolicitudAmistad(jugador)}
                        disabled={enviandoSolicitudA === jugador.id}
                        title={`Añadir a ${jugador.nombre} como amigo`}
                        className="flex h-7 w-7 items-center justify-center rounded-full border border-secondary/40 text-secondary transition-colors hover:bg-secondary/15 disabled:opacity-50"
                      >
                        <UserPlus className="h-3.5 w-3.5" />
                      </button>
                    )}
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-bold ${
                        jugador.listo ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"
                      }`}
                    >
                      {jugador.listo ? "Listo" : "Esperando"}
                    </span>
                  </div>
                </div>
              );
            })}

            {Array.from({ length: sala.maxJugadores - sala.jugadores.length }).map((_, i) => (
              <div key={`hueco-${i}`} className="flex items-center gap-3 px-4 py-3 opacity-40">
                <div className="h-11 w-11 shrink-0 rounded-full border border-dashed border-border" />
                <span className="text-sm text-muted-foreground">Esperando jugador...</span>
              </div>
            ))}
          </div>
        </div>

        {error && <p className="text-sm font-semibold text-destructive">{error}</p>}

        <div className="flex w-full flex-col gap-3">
          {esCreador ? (
            <GameButton onClick={empezarPartida} disabled={!puedeEmpezar || empezando} className="w-full py-3 text-base">
              {empezando
                ? "Empezando..."
                : sala.jugadores.length < 2
                  ? "Esperando a más jugadores..."
                  : !todosListos
                    ? "Esperando a que todos estén listos..."
                    : "Empezar partida"}
            </GameButton>
          ) : (
            <GameButton
              variant={miFila?.listo ? "secondary" : "primary"}
              onClick={alternarListo}
              disabled={marcandoListo}
              className="w-full py-3 text-base"
            >
              {miFila?.listo ? "Ya no estoy listo" : "Estoy listo"}
            </GameButton>
          )}

          <GameButton variant="destructive" onClick={() => setConfirmandoSalida(true)} className="w-full">
            Salir de la sala
          </GameButton>
        </div>

        <ConfirmDialog
          open={confirmandoSalida}
          onOpenChange={setConfirmandoSalida}
          titulo="¿Salir de la sala?"
          descripcion={
            esCreador
              ? "Eres el creador -- si sales, la sala se cierra para todos los que estén dentro."
              : "Puedes volver a unirte más tarde con el mismo código, si la sala sigue abierta."
          }
          textoConfirmar="Sí, salir"
          onConfirmar={salirDeLaSala}
        />
      </div>
    </div>
  );
}