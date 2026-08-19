// src/features/profile/LogroInsignia.tsx
//
// La insignia visual de un logro: un icono (uno por categoría, ver
// iconoDeLogro en src/lib/logros.ts) dentro de un cuadrado cuyo color
// depende del TIER (bronce -> ... -> legendario), más un pequeño
// distintivo según el estado (candado si está bloqueado, puntito verde
// pulsante si se puede reclamar, check dorado si ya se reclamó).
//
// El mapeo string -> componente de icono vive aquí (no en logros.ts)
// porque logros.ts se importa también desde el servidor, y ahí no puede
// arrastrar react/lucide.

import {
  Star, UserPlus, Swords, Grid3x3, ListOrdered, Flame, Zap, Target, Trophy, Compass, Medal, Shield, Crown,
  Lock, Check, type LucideIcon,
} from "lucide-react";
import type { LogroConProgreso, TierLogro } from "@/lib/logros";
import { iconoDeLogro } from "@/lib/logros";

const COMPONENTE_POR_ICONO: Record<string, LucideIcon> = {
  Star, UserPlus, Swords, Grid3x3, ListOrdered, Flame, Zap, Target, Trophy, Compass, Medal, Shield, Crown,
};

// La escala de "rareza" en sí -- el mismo orden que ORDEN_TIERS en
// logros.ts, aquí con sus colores de verdad. El último (legendario) lleva
// además más glow, para que se note que es el tier tope de un vistazo.
const COLOR_POR_TIER: Record<TierLogro, { color: string; bg: string }> = {
  bronce: { color: "#B4783D", bg: "rgba(180,120,61,0.14)" },
  plata: { color: "#A8AEB8", bg: "rgba(168,174,184,0.14)" },
  oro: { color: "#D4AF37", bg: "rgba(212,175,55,0.14)" },
  esmeralda: { color: "#4ADE9A", bg: "rgba(74,222,154,0.14)" },
  zafiro: { color: "#3FA9D6", bg: "rgba(63,169,214,0.14)" },
  amatista: { color: "#9B6BE8", bg: "rgba(155,107,232,0.14)" },
  rubi: { color: "#E0524F", bg: "rgba(224,82,79,0.14)" },
  legendario: { color: "#FFE8A3", bg: "rgba(255,232,163,0.18)" },
};

export function LogroInsignia({ logro, tamano = "md" }: { logro: LogroConProgreso; tamano?: "md" | "lg" }) {
  const Icono = COMPONENTE_POR_ICONO[iconoDeLogro(logro)] ?? Star;
  const bloqueado = logro.estado === "bloqueado";
  const reclamable = logro.estado === "reclamable";
  const tierColor = COLOR_POR_TIER[logro.tier];

  const tamanoCaja = tamano === "lg" ? "h-16 w-16 rounded-2xl" : "h-14 w-14 rounded-xl";
  const tamanoIcono = tamano === "lg" ? "h-7 w-7" : "h-6 w-6";

  if (bloqueado) {
    return (
      <div
        className={`flex ${tamanoCaja} shrink-0 items-center justify-center border border-dashed border-white/15 bg-white/[0.03]`}
      >
        <Lock className={`${tamanoIcono} text-muted-foreground/50`} />
      </div>
    );
  }

  return (
    <div className="relative shrink-0">
      <div
        className={`flex ${tamanoCaja} items-center justify-center border transition-all duration-300`}
        style={{
          backgroundColor: tierColor.bg,
          borderColor: tierColor.color,
          boxShadow:
            logro.tier === "legendario"
              ? `0 0 16px -2px ${tierColor.color}, 0 0 4px 0 ${tierColor.color}`
              : `0 0 10px -4px ${tierColor.color}`,
        }}
      >
        <Icono className={tamanoIcono} style={{ color: tierColor.color }} />
      </div>

      {reclamable && (
        <span
          aria-hidden
          className="absolute -right-1 -top-1 h-3.5 w-3.5 animate-pulse rounded-full bg-primary shadow-[0_0_8px_1px_rgba(74,222,154,0.8)]"
        />
      )}

      {logro.estado === "reclamado" && (
        <div
          className="absolute -bottom-1 -right-1 flex h-4.5 w-4.5 items-center justify-center rounded-full border-2 border-background"
          style={{ backgroundColor: tierColor.color }}
        >
          <Check className="h-2.5 w-2.5 text-background" strokeWidth={3} />
        </div>
      )}
    </div>
  );
}