import { GridIcon } from "@/components/icons/grid";
import { HigherLowerIcon } from "@/components/icons/higher-lower";
import { PodiumIcon } from "@/components/icons/PodiumIcon";

export type Acento = "primary" | "secondary";

// Etiqueta manual de la carta -- a mano a propósito, no es una estadística
// real (todavía no tenemos partidas jugadas de verdad registradas). Cuando
// exista eso, se podría sustituir HOT por "más jugado esta semana" o algo
// calculado, pero de momento es simplemente curatorial.
export type EtiquetaJuego = "HOT" | "BETA" | "NEW";

export type JuegoInfo = {
  href: string;
  nombre: string;
  descripcion: string;
  Icono: typeof GridIcon;
  acento: Acento;
  etiqueta?: EtiquetaJuego;
};

export const JUEGOS: JuegoInfo[] = [
  {
    href: "/jugar/grid",
    nombre: "3x3",
    descripcion: "Completa el tablero cruzando clubes y selecciones.",
    Icono: GridIcon,
    acento: "primary",
    etiqueta: "HOT",
  },
  {
    href: "/jugar/higher-lower",
    nombre: "Higher or Lower",
    descripcion: "Adivina quién tiene el valor más alto y mantén la racha.",
    Icono: HigherLowerIcon,
    acento: "secondary",
    etiqueta: "BETA",
  },
  {
    href: "/jugar/top10",
    nombre: "Top 10",
    descripcion: "Adivina los diez jugadores de un ranking, con pistas.",
    Icono: PodiumIcon,
    acento: "primary",
    etiqueta: "NEW",
  },
];