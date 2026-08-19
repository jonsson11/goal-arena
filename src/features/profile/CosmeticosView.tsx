"use client";

// src/features/profile/CosmeticosView.tsx
//
// Pestaña "Cosméticos" del Perfil (Fase 5, 19/08/2026, pedido explícito
// del usuario: "el jugador debería tener como un inventario de
// cosméticos, predeterminados + los que consiga"). De momento el único
// tipo de cosmético son los 6 escudos/aros de liga del modo Competitivo:
// Canterano siempre desbloqueado (es donde empieza todo el mundo), el
// resto se desbloquean para SIEMPRE en cuanto se alcanzan alguna vez
// (`User.trofeosMaximos`, el pico histórico -- no importa si luego bajas
// de trofeos). "Equipar" uno lo fija como el que se muestra en el Header
// y aquí mismo, en vez de la liga actual en vivo (ver `ligaMostrada` en
// src/lib/trofeos.ts) -- por eso son "opcionales": presumir de un hito
// pasado es una elección, no algo automático.

import { useState } from "react";
import { Check, Lock, Sparkles, Ban } from "lucide-react";
import { useAuth } from "@/features/auth/AuthContext";
import { ARO_OCULTO, LIGAS, ligaDesbloqueadaComoCosmetico, ligaPorTrofeos } from "@/lib/trofeos";
import { EscudoLiga } from "@/features/ranked/EscudoLiga";

export function CosmeticosView() {
  const { usuario, refrescarUsuario } = useAuth();
  const [guardando, setGuardando] = useState<string | null>(null); // id de liga en vuelo, o "AUTO"
  const [error, setError] = useState<string | null>(null);

  if (!usuario) return null;

  const ligaActual = ligaPorTrofeos(usuario.trofeos);

  async function equipar(ligaId: string | null) {
    setError(null);
    setGuardando(ligaId ?? "AUTO");
    try {
      const res = await fetch("/api/ranked/cosmetico", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ligaId }),
      });
      const datos = await res.json();
      if (!res.ok) {
        setError(datos.error ?? "No se pudo cambiar el cosmético.");
        return;
      }
      await refrescarUsuario();
    } catch {
      setError("No se pudo conectar con el servidor.");
    } finally {
      setGuardando(null);
    }
  }

  return (
    <div className="flex w-full min-w-0 flex-col gap-5">
      <div className="flex items-start gap-2 rounded-xl border border-border bg-card/50 px-4 py-3">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-secondary" />
        <p className="text-xs text-muted-foreground">
          Cada liga del modo Competitivo que alcances se queda desbloqueada para siempre, aunque luego bajes de
          trofeos. Elige cuál mostrar en tu avatar -- por defecto se enseña tu liga actual.
        </p>
      </div>

      {error && <p className="text-center text-sm text-destructive">{error}</p>}

      {/* Opción "Automático" -- vuelve a mostrar la liga actual en vivo en
          vez de una fija. Se pinta como una tarjeta más, con el propio
          escudo actual de protagonista, para que quede claro qué hace. */}
      <button
        onClick={() => equipar(null)}
        disabled={guardando !== null}
        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 disabled:opacity-60 ${
          usuario.aroEquipado === null
            ? "border-primary/60 bg-primary/10 shadow-[0_0_16px_-4px_rgba(74,222,154,0.5)]"
            : "border-border bg-card hover:border-primary/40"
        }`}
      >
        <EscudoLiga liga={ligaActual} tamano={56} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">Automático</p>
          <p className="truncate text-xs text-muted-foreground">Muestra siempre tu liga actual ({ligaActual.nombre})</p>
        </div>
        {usuario.aroEquipado === null && <Check className="h-5 w-5 shrink-0 text-primary" />}
      </button>

      {/* Opción "Sin aro" (pedido explícito del usuario, 19/08/2026): solo
          el avatar, sin ningún halo de liga encima -- tan legítima como
          elegir una liga concreta. */}
      <button
        onClick={() => equipar(ARO_OCULTO)}
        disabled={guardando !== null}
        className={`flex items-center gap-3 rounded-xl border p-3 text-left transition-all duration-200 disabled:opacity-60 ${
          usuario.aroEquipado === ARO_OCULTO
            ? "border-primary/60 bg-primary/10 shadow-[0_0_16px_-4px_rgba(74,222,154,0.5)]"
            : "border-border bg-card hover:border-primary/40"
        }`}
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full border border-border bg-muted text-2xl">
          {usuario.avatarTipo === "foto" ? (
            // eslint-disable-next-line @next/next/no-img-element -- previsualización del propio avatar del usuario
            <img src={usuario.avatar} alt={usuario.nombre} className="h-full w-full rounded-full object-cover" />
          ) : (
            usuario.avatar
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-foreground">Sin aro</p>
          <p className="truncate text-xs text-muted-foreground">Solo tu avatar, sin ningún halo de liga</p>
        </div>
        {usuario.aroEquipado === ARO_OCULTO ? (
          <Check className="h-5 w-5 shrink-0 text-primary" />
        ) : (
          <Ban className="h-5 w-5 shrink-0 text-muted-foreground" />
        )}
      </button>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {LIGAS.map((liga) => {
          const desbloqueada = ligaDesbloqueadaComoCosmetico(liga.id, usuario.trofeosMaximos);
          const equipada = usuario.aroEquipado === liga.id;
          const enVuelo = guardando === liga.id;

          return (
            <button
              key={liga.id}
              onClick={() => desbloqueada && equipar(liga.id)}
              disabled={!desbloqueada || guardando !== null}
              title={desbloqueada ? liga.nombre : `${liga.nombre} -- todavía no alcanzada`}
              className={`relative flex flex-col items-center gap-2 rounded-xl border p-3 text-center transition-all duration-200 ${
                !desbloqueada
                  ? "cursor-not-allowed border-border/60 bg-card/40 opacity-50"
                  : equipada
                    ? "border-primary/60 bg-primary/10 shadow-[0_0_16px_-4px_rgba(74,222,154,0.5)]"
                    : "border-border bg-card hover:-translate-y-0.5 hover:border-primary/40"
              } ${enVuelo ? "opacity-60" : ""}`}
            >
              {equipada && (
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md">
                  <Check className="h-3 w-3" />
                </span>
              )}
              <EscudoLiga liga={liga} tamano={56} className={!desbloqueada ? "grayscale" : ""} />
              <p className="text-xs font-bold text-foreground">{liga.nombre}</p>
              {!desbloqueada ? (
                <p className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Lock className="h-3 w-3" /> Sin alcanzar
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground">
                  {liga.rangoMin.toLocaleString("es-ES")}
                  {liga.rangoMax !== null ? ` – ${liga.rangoMax.toLocaleString("es-ES")}` : "+"} 🏆
                </p>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
