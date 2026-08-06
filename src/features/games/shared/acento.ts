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

// Fondo del icono dentro de la tarjeta -- mismo nivel de saturación que ya
// usan las tarjetas de cristal de /multijugador (bg-secondary/25 en
// "Crear sala", bg-primary/20 en "Unirse a sala"), para que las tarjetas
// de "Un jugador" (JuegoCromo.tsx) se vean exactamente igual de intensas.
export const ICONO_FONDO_POR_ACENTO: Record<Acento, string> = {
  primary: "bg-primary/20 text-primary",
  secondary: "bg-secondary/25 text-secondary",
  gold: "bg-[#D4AF37]/25 text-[#D4AF37]",
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

// Tarjeta de cristal (fondo semitransparente + backdrop-blur + borde de
// color, se aclara del todo al pasar el ratón) -- el mismo estilo que ya
// usan las tarjetas de /multijugador (Crear sala / Unirse a sala),
// llevado aquí para que JuegoCromo.tsx use EXACTAMENTE los mismos
// números, no una aproximación a ojo.
export const TARJETA_CRISTAL_POR_ACENTO: Record<Acento, string> = {
  primary: "border-primary/30 bg-primary/10 hover:border-primary hover:shadow-[0_8px_40px_-10px_rgba(74,222,154,0.55)]",
  secondary:
    "border-secondary/35 bg-secondary/[0.12] hover:border-secondary hover:shadow-[0_8px_40px_-10px_rgba(29,122,156,0.6)]",
  gold: "border-[#D4AF37]/30 bg-[#D4AF37]/10 hover:border-[#D4AF37] hover:shadow-[0_8px_40px_-10px_rgba(212,175,55,0.55)]",
};