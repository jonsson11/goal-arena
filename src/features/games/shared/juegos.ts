import { GridIcon } from "@/components/icons/grid";
import { HigherLowerIcon } from "@/components/icons/higher-lower";
import { PodiumIcon } from "@/components/icons/PodiumIcon";

export type Acento = "primary" | "secondary";

export type JuegoInfo = {
  href: string;
  nombre: string;
  descripcion: string;
  Icono: typeof GridIcon;
  acento: Acento;
};

export const JUEGOS: JuegoInfo[] = [
  {
    href: "/jugar/grid",
    nombre: "3x3",
    descripcion: "Completa el tablero cruzando clubes y selecciones.",
    Icono: GridIcon,
    acento: "primary",
  },
  {
    href: "/jugar/higher-lower",
    nombre: "Higher or Lower",
    descripcion: "Adivina quién tiene el valor más alto y mantén la racha.",
    Icono: HigherLowerIcon,
    acento: "secondary",
  },
  {
    href: "/jugar/top10",
    nombre: "Top 10",
    descripcion: "Adivina los diez jugadores de un ranking, con pistas.",
    Icono: PodiumIcon,
    acento: "primary",
  },
];