import { JUEGOS } from "@/features/games/shared/juegos";
import { JuegoCromo } from "@/features/games/shared/JuegoCromo";
import { BotonAtras } from "@/features/games/shared/BotonAtras";

// Posiciones fijas (no aleatorias -- Math.random() no es válido en un
// Server Component, y tampoco hace falta: unas pocas partículas quietas ya
// dan el efecto de fondo).
const PARTICULAS = [
  { left: "8%", delay: "0s" },
  { left: "22%", delay: "2s" },
  { left: "40%", delay: "4s" },
  { left: "63%", delay: "1s" },
  { left: "78%", delay: "5s" },
  { left: "91%", delay: "3s" },
];

export default function JugarPage() {
  return (
    <div className="relative overflow-hidden px-6 pb-14 pt-8 sm:pt-10">
      {PARTICULAS.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="particula-flotante pointer-events-none fixed h-[3px] w-[3px] rounded-full bg-primary opacity-35"
          style={{ left: p.left, animationDelay: p.delay }}
        />
      ))}

      {/* Fuera de la columna centrada de abajo, pegado al borde real de
          la pantalla -- mismo criterio que ya usan las pantallas de
          multijugador (ver comentario largo en esas páginas). */}
      <BotonAtras href="/" />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-2">
        <h1
          className="text-shimmer bg-gradient-to-r from-primary via-secondary to-primary bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
          style={{ textShadow: "0 0 30px rgba(74,222,154,0.25)" }}
        >
          Un jugador
        </h1>
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Elige tu reto y juega a tu ritmo. Toca una carta para ver de qué va (en escritorio
          también puedes pasar el cursor).
        </p>

        <div className="grid w-full grid-cols-1 gap-9 sm:grid-cols-3">
          {JUEGOS.map(({ Icono, ...juego }) => (
            <JuegoCromo key={juego.href} juego={juego} icono={<Icono className="h-9 w-9" />} />
          ))}
        </div>
      </div>
    </div>
  );
}