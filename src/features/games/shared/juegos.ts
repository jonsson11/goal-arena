import { GridIcon } from "@/components/icons/grid";
import { HigherLowerIcon } from "@/components/icons/higher-lower";
import { PodiumIcon } from "@/components/icons/PodiumIcon";

// El tipo y los mapas de color a Tailwind viven en ./acento.ts (lo comparten
// JuegoCromo, GamesCarousel y GameLauncher). Se re-exporta aquí para no
// romper el resto de imports que ya hacían `import type { Acento } from
// "./juegos"`.
import type { Acento } from "./acento";
export type { Acento } from "./acento";

// Etiqueta manual de la carta -- a mano a propósito, no es una estadística
// real (todavía no tenemos partidas jugadas de verdad registradas). Cuando
// exista eso, se podría sustituir HOT por "más jugado esta semana" o algo
// calculado, pero de momento es simplemente curatorial.
export type EtiquetaJuego = "HOT" | "BETA" | "NEW";

export type JuegoInfo = {
  href: string;
  nombre: string;
  // Frase cortita en mayúsculas que va encima del nombre, a modo de
  // "kicker" (mismo recurso visual que el titular de /inicio: frase neutra
  // + acento de color, aquí en dos líneas en vez de en la misma).
  categoria: string;
  descripcion: string;
  Icono: typeof GridIcon;
  acento: Acento;
  etiqueta?: EtiquetaJuego;
};

export const JUEGOS: JuegoInfo[] = [
  {
    href: "/jugar/grid",
    nombre: "3x3",
    categoria: "Modo clásico",
    descripcion: "Completa el tablero cruzando clubes y selecciones.",
    Icono: GridIcon,
    acento: "primary",
    etiqueta: "HOT",
  },
  {
    href: "/jugar/higher-lower",
    nombre: "Higher or Lower",
    categoria: "Racha infinita",
    descripcion: "Adivina quién tiene el valor más alto y mantén la racha.",
    Icono: HigherLowerIcon,
    acento: "secondary",
    etiqueta: "BETA",
  },
  {
    href: "/jugar/top10",
    nombre: "Top 10",
    categoria: "Ranking histórico",
    descripcion: "Adivina los diez jugadores de un ranking, con pistas.",
    Icono: PodiumIcon,
    acento: "gold",
    etiqueta: "NEW",
  },
];