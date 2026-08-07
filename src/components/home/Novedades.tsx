// src/components/home/Novedades.tsx
//
// Sustituye a ArenasTeaser.tsx (07/08/2026) -- aquella sección solo
// promocionaba el multijugador, y esa misma noticia es ahora una de las
// tarjetas rotatorias de "Recién lanzado" de aquí abajo, así que tener
// las dos secciones habría repetido el mismo mensaje dos veces seguidas
// en la misma página.
//
// "Recién lanzado": una única tarjeta destacada que va rotando sola
// (como ya hace GamesCarousel.tsx, mismo mecanismo de setInterval + dots)
// en vez de una rejilla de 3 tarjetas fijas -- así hay movimiento real
// sin llenar la página de golpe. Sin borde girando ni efectos de más: se
// probó una versión con un borde en degradado rotando y no convenció,
// demasiado "menú de videojuego" para el usuario -- se quedó solo el
// carrusel de contenido, con el mismo borde/sombra de cristal fijo que
// ya usa el resto de la app.
//
// "Próximamente": una cinta que se desliza sola en bucle infinito
// (reutiliza la animación CSS `.ticker-movimiento`/`mover-ticker` que ya
// existía en globals.css pero estaba huérfana -- la usaba JuegoTicker.tsx,
// un componente con datos de actividad inventados que no se llegó a usar
// en ningún sitio; se ha borrado). Con borde discontinuo para que se note
// a simple vista que no es clicable todavía.

"use client";

import { useEffect, useState } from "react";
import { Users, Star, Sparkles, Trophy, ListOrdered, BarChart3, type LucideIcon } from "lucide-react";

type Destacado = { Icono: LucideIcon; titulo: string; descripcion: string };

const RECIEN_LANZADO: Destacado[] = [
  {
    Icono: Users,
    titulo: "Multijugador en directo",
    descripcion: "Reta a tus amigos en salas de hasta 8 jugadores, con el mismo tablero y el mismo tiempo para todos.",
  },
  {
    Icono: Star,
    titulo: "Niveles y experiencia",
    descripcion: "Sube de nivel jugando, con bono extra por rapidez y por tu primera victoria del día.",
  },
  {
    Icono: Sparkles,
    titulo: "Diseño renovado",
    descripcion: "Nuevo aspecto en toda la web, pensado para ir más rápido y verse mejor en el móvil.",
  },
];

const PROXIMAMENTE: { Icono: LucideIcon; titulo: string }[] = [
  { Icono: Trophy, titulo: "Logros y recompensas" },
  { Icono: ListOrdered, titulo: "Top 10 multijugador" },
  { Icono: BarChart3, titulo: "Historial contra amigos" },
];

const INTERVALO_MS = 3200;

export function Novedades() {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    const intervalo = setInterval(() => {
      setIndice((actual) => (actual + 1) % RECIEN_LANZADO.length);
    }, INTERVALO_MS);
    return () => clearInterval(intervalo);
  }, []);

  const { Icono, titulo, descripcion } = RECIEN_LANZADO[indice];
  const cintaProximamente = [...PROXIMAMENTE, ...PROXIMAMENTE];

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-3 px-6 py-16">
      <span className="self-start rounded-full bg-primary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-primary">
        Recién lanzado
      </span>

      <div className="flex items-center gap-4 rounded-2xl border border-primary/30 bg-primary/[0.06] p-6 shadow-[0_0_30px_-10px_rgba(74,222,154,0.4)]">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary/15 text-primary">
          <Icono className="h-7 w-7" />
        </span>
        <div className="min-w-0">
          <p className="text-base font-extrabold text-foreground">{titulo}</p>
          <p className="text-sm text-muted-foreground">{descripcion}</p>
        </div>
      </div>

      <div className="flex justify-center gap-1.5">
        {RECIEN_LANZADO.map((_, i) => (
          <span
            key={i}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === indice ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30"
            }`}
          />
        ))}
      </div>

      <span className="mt-8 self-start rounded-full bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
        Próximamente
      </span>

      <div
        className="overflow-hidden"
        style={{
          maskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
          WebkitMaskImage: "linear-gradient(90deg, transparent, black 8%, black 92%, transparent)",
        }}
      >
        <div className="ticker-movimiento flex w-max gap-3">
          {cintaProximamente.map(({ Icono: IconoProximo, titulo: tituloProximo }, i) => (
            <span
              key={i}
              className="flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full border border-dashed border-secondary/35 bg-secondary/5 px-4 py-2 text-xs font-semibold text-muted-foreground"
            >
              <IconoProximo className="h-3.5 w-3.5 text-secondary" />
              {tituloProximo}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}