import { GridIcon } from "@/components/icons/grid";
import { LinkPlayersIcon } from "@/components/icons/link-players";
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
export type EtiquetaJuego = "DISPONIBLE" | "BETA" | "NEW";

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
  // Usados por GameLauncher.tsx (pantalla intermedia antes de cada juego):
  // `reto` es una frase corta a modo de desafío/gancho (más punchy que
  // `descripcion`, que se queda como texto explicativo de apoyo). `stats`
  // son 2-3 datos rápidos y honestos sobre el juego (nada de cifras
  // inventadas de "gente jugando ahora" -- eso ya está marcado como
  // placeholder en JuegoTicker, aquí no se repite ese patrón).
  reto: string;
  stats: string[];
  // Ruta en /public a una captura de pantalla real del juego (recomendado
  // 4:3, ej. 960x720). Si no hay captura todavía, GameLauncher cae a un
  // mockup estilizado con el icono del juego -- no revienta sin imagen.
  imagen?: string;
};

export const JUEGOS: JuegoInfo[] = [
  {
    href: "/jugar/grid",
    nombre: "3x3",
    categoria: "Modo clásico",
    descripcion: "Completa el tablero cruzando clubes y selecciones.",
    Icono: GridIcon,
    acento: "primary",
    etiqueta: "DISPONIBLE",
    reto: "¿Serás capaz de completar el tablero sin fallar ni una casilla?",
    stats: ["🎯 9 casillas por partida", "⏱️ ~2-3 min", "🧠 Dificultad media"],
    imagen: "/capturas/3x32.jpg"
  },
 {
    href: "/jugar/linkplayers",
    nombre: "LinkPlayers",
    categoria: "Enlaza los jugadores",
    descripcion: "Conecta a dos jugadores a través de compañeros de club, en el menor número de Steps.",
    Icono: LinkPlayersIcon,
    acento: "secondary",
    etiqueta: "NEW",
    reto: "El camino más corto ya está calculado. ¿Puedes igualarlo?",
    stats: ["🔗 Camino más corto calculado", "⏱️ ~3-5 min", "🧠 Dificultad variable"],
    imagen: "/capturas/linkplayers.jpg"
  },
  {
    href: "/jugar/top10",
    nombre: "Top 10",
    categoria: "Ranking histórico",
    descripcion: "Adivina los diez jugadores de un ranking, con pistas.",
    Icono: PodiumIcon,
    acento: "gold",
    etiqueta: "DISPONIBLE",
    reto: "Diez nombres, sin pistas de más. ¿Cuántos aciertas a la primera?",
    stats: ["🏆 10 nombres por ranking", "⏱️ ~3-5 min", "🧠 Dificultad alta"],
    imagen: "/capturas/top10.jpg"
  },
];