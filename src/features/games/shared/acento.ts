// src/features/games/shared/acento.ts
//
// Color de "marca" de cada juego. Antes era un simple primary/secondary
// (verde/teal) repartido a ojo con ternarias en cada sitio que lo pintaba
// (JuegoCromo, GamesCarousel, GameLauncher) -- al añadir un tercer color
// para Top 10, esas ternarias de dos ramas se habrían quedado mal (todo lo
// que no fuera "primary" habría caído en "secondary"). Centralizarlo aquí
// hace que añadir/cambiar un acento se haga en un solo sitio.

export type Acento = "primary" | "secondary" | "gold";

// Dorado para Top 10 -- ya es el color que usa esa pantalla para el 1er
// puesto del ranking, así que reutilizarlo aquí como color de marca del
// juego entero es un guiño consistente, no un color nuevo sin motivo.
//
// OJO: las clases con "#D4AF37" están escritas en LITERAL en cada entrada
// (nada de plantillas/interpolación tipo `text-[${GOLD}]`). Tailwind
// analiza el código fuente en el momento de compilar buscando el nombre de
// clase completo tal cual aparece escrito -- si se construye la clase
// concatenando variables, Tailwind no la detecta y no genera el CSS, y el
// color simplemente no se aplica (falla en silencio, sin error).

// Valor hex "en crudo" de cada acento, para sitios donde hace falta un color
// de verdad en JS/inline style (glows dinámicos, canvas, partículas con color
// por juego...) en vez de una clase Tailwind. Usado por primera vez en
// GameLauncher.tsx (halo + partículas + fondo del mockup de captura).
export const COLOR_HEX_POR_ACENTO: Record<Acento, string> = {
  primary: "#4ADE9A",
  secondary: "#1D7A9C",
  gold: "#D4AF37",
};

export const TEXTO_POR_ACENTO: Record<Acento, string> = {
  primary: "text-primary",
  secondary: "text-secondary",
  gold: "text-[#D4AF37]",
};

export const ICONO_FONDO_POR_ACENTO: Record<Acento, string> = {
  primary: "bg-primary/10 text-primary",
  secondary: "bg-secondary/15 text-secondary",
  gold: "bg-[#D4AF37]/15 text-[#D4AF37]",
};

// Degradado sutil de fondo para la cara trasera del cromo en JuegoCromo.tsx.
export const DEGRADADO_FONDO_POR_ACENTO: Record<Acento, string> = {
  primary: "from-primary/10 to-card",
  secondary: "from-secondary/15 to-card",
  gold: "from-[#D4AF37]/10 to-card",
};

export const ICONO_BORDE_FONDO_POR_ACENTO: Record<Acento, string> = {
  primary: "border-primary/40 bg-primary/10",
  secondary: "border-secondary/40 bg-secondary/10",
  gold: "border-[#D4AF37]/40 bg-[#D4AF37]/10",
};

// Borde + resplandor SIEMPRE visibles (sin hover), para GamesCarousel.tsx.
export const BORDE_SOMBRA_FIJA_POR_ACENTO: Record<Acento, string> = {
  primary: "border-primary/30 shadow-[0_0_30px_-4px_rgba(74,222,154,0.4)]",
  secondary: "border-secondary/30 shadow-[0_0_30px_-4px_rgba(29,122,156,0.5)]",
  gold: "border-[#D4AF37]/30 shadow-[0_0_30px_-4px_rgba(212,175,55,0.45)]",
};

export const BORDE_HOVER_GLOW_POR_ACENTO: Record<Acento, string> = {
  primary: "border-primary/30 hover:border-primary hover:shadow-[0_0_30px_-4px_rgba(74,222,154,0.5)]",
  secondary: "border-secondary/30 hover:border-secondary hover:shadow-[0_0_30px_-4px_rgba(29,122,156,0.6)]",
  gold: "border-[#D4AF37]/30 hover:border-[#D4AF37] hover:shadow-[0_0_30px_-4px_rgba(212,175,55,0.55)]",
};

export const HALO_POR_ACENTO: Record<Acento, string> = {
  primary:
    "shadow-[0_0_34px_-6px_rgba(74,222,154,0.35),0_0_0_1px_rgba(74,222,154,0.08)] hover:shadow-[0_0_55px_-4px_rgba(74,222,154,0.65),0_0_0_1px_rgba(74,222,154,0.25)]",
  secondary:
    "shadow-[0_0_34px_-6px_rgba(29,122,156,0.45),0_0_0_1px_rgba(29,122,156,0.10)] hover:shadow-[0_0_55px_-4px_rgba(29,122,156,0.75),0_0_0_1px_rgba(29,122,156,0.3)]",
  gold: "shadow-[0_0_34px_-6px_rgba(212,175,55,0.4),0_0_0_1px_rgba(212,175,55,0.1)] hover:shadow-[0_0_55px_-4px_rgba(212,175,55,0.7),0_0_0_1px_rgba(212,175,55,0.3)]",
};

// Ver el comentario de HALO_ACTIVO_POR_ACENTO en JuegoCromo.tsx: se usa en
// vez de HALO_POR_ACENTO (no combinado con él) cuando la carta está activa.
export const HALO_ACTIVO_POR_ACENTO: Record<Acento, string> = {
  primary: "shadow-[0_0_55px_-4px_rgba(74,222,154,0.65),0_0_0_1px_rgba(74,222,154,0.25)]",
  secondary: "shadow-[0_0_55px_-4px_rgba(29,122,156,0.75),0_0_0_1px_rgba(29,122,156,0.3)]",
  gold: "shadow-[0_0_55px_-4px_rgba(212,175,55,0.7),0_0_0_1px_rgba(212,175,55,0.3)]",
};
