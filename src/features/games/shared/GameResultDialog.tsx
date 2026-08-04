"use client";

import type { CSSProperties, ReactNode } from "react";
import { Trophy, Flag, RotateCcw, Eye, EyeOff, X } from "lucide-react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { GameButton } from "./GameButton";
import { ExperienciaGanada } from "./ExperienciaGanada";
import type { RespuestaPartida } from "@/lib/experiencia";

type ResultadoJuego = "exito" | "fracaso";

// Opcional -- solo lo pasa el 3x3 por ahora. El botón despliega/pliega
// `contenido` DENTRO de este mismo cartel (a diferencia del viejo popup de
// soluciones por casilla que había en modo debug, que abría uno encima de
// otro). Los demás juegos (Higher/Lower, Top10) simplemente no pasan esta
// prop y el botón no aparece.
type RespuestasCorrectasProps = {
  mostrando: boolean;
  onToggle: () => void;
  contenido: ReactNode;
};

type GameResultDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  resultado: ResultadoJuego;
  titulo: string;
  descripcion: ReactNode;
  onJugarDeNuevo: () => void;
  respuestasCorrectas?: RespuestasCorrectasProps;
  /** Solo en victorias. Si viene, se enseña la sección de EXP ganada con
   * la barra de nivel animándose (ver ExperienciaGanada.tsx). En derrota
   * no se pasa nunca -- no se otorga EXP al perder. */
  experiencia?: RespuestaPartida | null;
};

// Un tono por resultado (verde de marca para la victoria, el mismo rojo que
// ya usa el botón "Rendirse" para la derrota) en vez de los emojis de
// antes -- coherente con el resto de la app, que ya usa esta paleta para
// comunicar estado (ver acento.ts y GameLauncher.tsx).
const COLOR_POR_RESULTADO: Record<ResultadoJuego, string> = {
  exito: "#4ADE9A",
  fracaso: "#E0524F",
};

// Partículas de fondo dentro del cartel -- mismo patrón que en
// GameLauncher.tsx (posiciones fijas, no Math.random(), para no pelearse
// con la hidratación), a menor escala porque el cartel es mucho más
// pequeño que la pantalla de lanzamiento.
const PARTICULAS = [
  { left: "8%", delay: "0s" },
  { left: "28%", delay: "2.2s" },
  { left: "52%", delay: "1s" },
  { left: "74%", delay: "3.4s" },
  { left: "92%", delay: "0.6s" },
];

// Mismo helper que GameLauncher.tsx para fijar la variable CSS --retraso
// (usada por .launcher-entrada en globals.css) sin pelearse con el tipado
// de CSSProperties. Duplicado a propósito en vez de compartido -- son dos
// componentes pequeños e independientes, no vale la pena una dependencia
// cruzada por una función de tres líneas.
function conRetraso(segundos: number): CSSProperties {
  return { ["--retraso" as string]: `${segundos}s` } as CSSProperties;
}

// Botón de cerrar propio, en vez del showCloseButton por defecto de
// <DialogContent> -- así se puede colocar con más contraste (círculo con
// borde y fondo, no solo un icono suelto) y queda claramente por encima
// del resto de capas decorativas (partículas, resplandor). Importa
// directamente del primitivo (no de dialog.tsx, que no expone un
// DialogClose "pelado" con estilos propios) para tener control total del
// aspecto.
function BotonCerrar() {
  return (
    <DialogPrimitive.Close
      className="absolute right-3 top-3 z-20 flex h-8 w-8 items-center justify-center rounded-full border border-border bg-card/80 text-muted-foreground backdrop-blur transition-colors hover:border-foreground/30 hover:text-foreground"
      aria-label="Cerrar"
    >
      <X className="h-4 w-4" />
    </DialogPrimitive.Close>
  );
}

export function GameResultDialog({
  open,
  onOpenChange,
  resultado,
  titulo,
  descripcion,
  onJugarDeNuevo,
  respuestasCorrectas,
  experiencia,
}: GameResultDialogProps) {
  const esExito = resultado === "exito";
  const color = COLOR_POR_RESULTADO[resultado];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* OJO: aquí NO se añade "relative" -- la clase base de <DialogContent>
          ya trae "fixed" (es lo que centra el popup en la pantalla), y como
          el cn() del proyecto usa tailwind-merge, dos clases de "position"
          en conflicto (fixed vs relative) hacen que solo sobreviva la
          última -- si esta clase llevara "relative", rompería el fixed de
          base (esto pasó en una versión anterior: el cartel dejaba de
          estar centrado/anclado y la página "se iba hacia abajo" al
          desplegar contenido largo). "fixed" ya sirve de contenedor de
          posicionamiento para los hijos "absolute" de aquí abajo, así que
          no hace falta relative para nada.

          max-h-[85vh] + overflow-y-auto: si el contenido crece mucho (al
          desplegar las respuestas correctas), el propio cartel hace scroll
          interno en vez de estirar la página entera y dejar el botón
          "Volver a jugar" fuera de la pantalla. */}
      <DialogContent
        showCloseButton={false}
        className={`max-h-[85vh] overflow-y-auto overflow-x-hidden [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden bg-card text-center shadow-[0_0_70px_-15px_var(--glow)] ring-1 sm:max-w-md ${
          esExito ? "border-primary/40 ring-primary/20" : "border-destructive/40 ring-destructive/20"
        }`}
        style={
          {
            ["--glow" as string]: `${color}55`,
            backgroundImage: `radial-gradient(120% 60% at 50% -10%, ${color}14, transparent)`,
          } as CSSProperties
        }
      >
        {/* Capa puramente decorativa (franja de acento, partículas,
            resplandor) con su propio overflow-hidden, en vez de fiarse del
            de <DialogContent> -- ese pasó a overflow-y-auto para poder
            hacer scroll cuando el contenido (con la sección de EXP) no cabe
            en pantallas bajas, y sin esta capa aparte las partículas
            asomaban por debajo del cartel, fuera de las esquinas
            redondeadas. rounded-[inherit] copia el radio del propio
            <DialogContent> sin repetirlo a mano. La barra de scroll en sí
            se oculta arriba (scrollbar-width / ::-webkit-scrollbar) -- el
            scroll sigue funcionando con rueda/gesto, solo desaparece la
            barra gris que rompía las esquinas redondeadas. */}
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
          <div
            className="absolute inset-x-0 top-0 h-1.5"
            style={{ backgroundImage: `linear-gradient(90deg, transparent, ${color}, transparent)` }}
          />

          {PARTICULAS.map((p, i) => (
            <span
              key={i}
              className="particula-flotante absolute bottom-0 h-[3px] w-[3px] rounded-full opacity-40"
              style={{ left: p.left, animationDelay: p.delay, backgroundColor: color }}
            />
          ))}

          <div
            className="absolute left-1/2 top-0 h-40 w-64 -translate-x-1/2 -translate-y-1/3 rounded-full blur-3xl"
            style={{ backgroundColor: color, opacity: 0.2 }}
          />
        </div>

        <BotonCerrar />

        <DialogHeader className="relative z-10 items-center gap-3 pt-1">
          <div
            // Una sola clase a propósito: .resultado-icono-entrada ya incluye
            // TANTO el rebote de entrada como el pulso continuo (referencia
            // el keyframe launcher-halo-pulso por nombre en su propio
            // `animation`) -- añadir también la clase .launcher-halo-pulso
            // aquí sería redundante y, según el orden final del CSS
            // compilado, una de las dos reglas pisaría a la otra (la
            // propiedad `animation` no se combina entre clases).
            className="resultado-icono-entrada flex h-[4.5rem] w-[4.5rem] items-center justify-center rounded-full"
            style={
              {
                backgroundColor: `${color}26`,
                color,
                ["--glow-color" as string]: `${color}73`,
              } as CSSProperties
            }
          >
            {esExito ? <Trophy className="h-9 w-9" /> : <Flag className="h-9 w-9" />}
          </div>

          <DialogTitle
            className="launcher-entrada text-shimmer bg-clip-text text-4xl font-extrabold tracking-tight text-transparent"
            style={{
              backgroundImage: `linear-gradient(90deg, ${color}, #ffffff, ${color})`,
              textShadow: `0 0 24px ${color}55`,
              ...conRetraso(0.1),
            }}
          >
            {titulo}
          </DialogTitle>

          <DialogDescription
            className="launcher-entrada rounded-lg border border-border/60 bg-background/50 px-4 py-2 text-base text-foreground/90"
            style={conRetraso(0.18)}
          >
            {descripcion}
          </DialogDescription>
        </DialogHeader>

        {esExito && experiencia && (
          <div className="launcher-entrada relative z-10 w-full" style={conRetraso(0.24)}>
            <ExperienciaGanada respuesta={experiencia} />
          </div>
        )}

        {respuestasCorrectas && (
          <div
            className="launcher-entrada relative z-10 flex w-full flex-col items-center gap-2"
            style={conRetraso(0.26)}
          >
            <GameButton
              variant="secondary"
              onClick={respuestasCorrectas.onToggle}
              className="flex w-full items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
            >
              {respuestasCorrectas.mostrando ? (
                <>
                  <EyeOff className="h-4 w-4" /> Ocultar respuestas correctas
                </>
              ) : (
                <>
                  <Eye className="h-4 w-4" /> Mostrar respuestas correctas
                </>
              )}
            </GameButton>
            {respuestasCorrectas.mostrando && respuestasCorrectas.contenido}
          </div>
        )}

        <GameButton
          onClick={onJugarDeNuevo}
          className="launcher-entrada relative z-10 mt-2 flex items-center justify-center gap-2 transition-transform hover:scale-[1.02]"
          style={conRetraso(0.34)}
        >
          <RotateCcw className="h-4 w-4" />
          Volver a jugar
        </GameButton>
      </DialogContent>
    </Dialog>
  );
}