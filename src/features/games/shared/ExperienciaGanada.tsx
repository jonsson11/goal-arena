// src/features/games/shared/ExperienciaGanada.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/features/auth/AuthContext";
import { BONUS_DIARIO_EXP, type RespuestaPartida } from "@/lib/experiencia";

// Tiempos de la secuencia de animación, en ms desde que se monta. Solo se
// usan si hubo subida de nivel -- sin subida es un solo tramo (ver abajo).
const ESPERA_INICIAL = 500; // deja que se vea la barra "de antes" un instante
const DURACION_LLENADO = 900; // debe cuadrar con duration-[900ms] de la barra
const ESPERA_DESTELLO = ESPERA_INICIAL + DURACION_LLENADO + 50;
const ESPERA_RESET = ESPERA_DESTELLO + 300;
const ESPERA_RELLENO_FINAL = ESPERA_RESET + 100;
const ESPERA_FIN_DESTELLO = ESPERA_RELLENO_FINAL + 800;

/**
 * Sección que aparece dentro del cartel de victoria (GameResultDialog)
 * con la EXP ganada y la barra de nivel subiendo. Si la partida hizo
 * subir de nivel, la barra se llena del todo, hay un destello dorado con
 * el nivel nuevo, y se reinicia a 0 para seguir rellenándose con lo que
 * sobró -- igual que en cualquier juego con niveles.
 *
 * Devuelve null si no hay nada que animar (derrota, o todavía sin
 * respuesta del servidor) -- así el que la usa (GameResultDialog) puede
 * pasarla siempre sin comprobar antes.
 */
export function ExperienciaGanada({ respuesta }: { respuesta: RespuestaPartida | null }) {
  const { usuario } = useAuth();

  const [nivelMostrado, setNivelMostrado] = useState(respuesta?.estadoAntes.nivel ?? 1);
  const [anchoBarra, setAnchoBarra] = useState(0);
  const [sinTransicion, setSinTransicion] = useState(true);
  const [destelloNivel, setDestelloNivel] = useState(false);
  const [mostrarTexto, setMostrarTexto] = useState(false);

  useEffect(() => {
    if (!respuesta) return;
    const { estadoAntes, estadoDespues } = respuesta;

    setNivelMostrado(estadoAntes.nivel);
    setSinTransicion(true);
    setAnchoBarra(Math.min(100, (estadoAntes.xpActual / estadoAntes.xpSiguienteNivel) * 100));
    setDestelloNivel(false);
    setMostrarTexto(false);

    const temporizadores: ReturnType<typeof setTimeout>[] = [];
    const en = (ms: number, fn: () => void) => temporizadores.push(setTimeout(fn, ms));

    en(50, () => setSinTransicion(false));
    en(150, () => setMostrarTexto(true));

    if (!estadoDespues.subioDeNivel) {
      en(ESPERA_INICIAL, () => {
        setAnchoBarra(Math.min(100, (estadoDespues.xpActual / estadoDespues.xpSiguienteNivel) * 100));
      });
      return () => temporizadores.forEach(clearTimeout);
    }

    // Con subida de nivel: llena hasta el borde, destello + nivel nuevo,
    // vuelve a 0 sin transición, y rellena lo que sobró en el nivel nuevo.
    en(ESPERA_INICIAL, () => setAnchoBarra(100));
    en(ESPERA_DESTELLO, () => {
      setDestelloNivel(true);
      setNivelMostrado(estadoDespues.nivel);
    });
    en(ESPERA_RESET, () => {
      setSinTransicion(true);
      setAnchoBarra(0);
    });
    en(ESPERA_RELLENO_FINAL, () => {
      setSinTransicion(false);
      setAnchoBarra(Math.min(100, (estadoDespues.xpActual / estadoDespues.xpSiguienteNivel) * 100));
    });
    en(ESPERA_FIN_DESTELLO, () => setDestelloNivel(false));

    return () => temporizadores.forEach(clearTimeout);
  }, [respuesta]);

  if (!respuesta || !usuario) return null;

  const { bonusTiempoPct, bonusDiario, expGanada } = respuesta;

  return (
    <div className="launcher-entrada relative z-10 flex w-full flex-col gap-2.5 rounded-xl border border-primary/25 bg-background/40 p-4">
      {/* Destello de subida de nivel -- superpuesto, no empuja el resto del
          layout al aparecer/desaparecer (position absolute + fade). */}
      {destelloNivel && (
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl bg-background/90 backdrop-blur-sm animate-in fade-in zoom-in-95 duration-300"
        >
          <p
            className="text-shimmer bg-clip-text text-2xl font-extrabold tracking-tight text-transparent"
            style={{ backgroundImage: "linear-gradient(90deg, var(--gold), #ffffff, var(--gold))" }}
          >
            ¡Subiste a nivel {nivelMostrado}!
          </p>
        </div>
      )}

      {/* Mini perfil: avatar + nombre + nivel */}
      <div className="flex items-center gap-2.5">
        {usuario.avatarTipo === "foto" ? (
          // eslint-disable-next-line @next/next/no-img-element -- avatar personalizado del usuario
          <img
            src={usuario.avatar}
            alt={usuario.nombre}
            className="h-8 w-8 shrink-0 rounded-full border border-primary/40 object-cover"
          />
        ) : (
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-primary/40 bg-primary/10 text-base">
            {usuario.avatar}
          </div>
        )}
        <span className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-foreground">
          {usuario.nombre}
        </span>
        <span className="shrink-0 rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary transition-all duration-300">
          Nivel {nivelMostrado}
        </span>
      </div>

      {/* Barra de nivel */}
      <div className="h-2.5 w-full overflow-hidden rounded-full bg-muted">
        <div
          className={`h-full rounded-full bg-primary shadow-[0_0_8px_0_rgba(74,222,154,0.7)] ${
            sinTransicion ? "" : "duration-[900ms] transition-all ease-out"
          }`}
          style={{ width: `${anchoBarra}%` }}
        />
      </div>

      {/* EXP ganada */}
      <div
        className={`flex flex-wrap items-center justify-center gap-2 transition-all duration-500 ${
          mostrarTexto ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
        }`}
      >
        <span className="text-sm font-bold text-primary">+{expGanada} EXP</span>
        {bonusTiempoPct > 0 && (
          <span className="rounded-full bg-[var(--secondary)]/15 px-2 py-0.5 text-xs font-bold text-[var(--secondary)]">
            ⚡ +{bonusTiempoPct}% rapidez
          </span>
        )}
        {bonusDiario && (
          <span className="rounded-full bg-[var(--gold)]/15 px-2 py-0.5 text-xs font-bold text-[var(--gold)]">
            🔥 +{BONUS_DIARIO_EXP} bono diario
          </span>
        )}
      </div>
    </div>
  );
}
