"use client";

import { useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { JUEGOS } from "./juegos";
import { GameButton } from "./GameButton";
import { COLOR_HEX_POR_ACENTO } from "./acento";
import type { Dificultad } from "./types";

type GameLauncherProps = {
  href: string;
  // Cuando `dificultades` es true, `children` debe ser una función que
  // recibe la dificultad elegida (para poder pasársela, p. ej., al
  // componente del tablero). Cuando es false (o se omite), `children` es
  // el nodo de siempre y se muestra el único botón "Empezar partida".
  children: ReactNode | ((dificultad: Dificultad) => ReactNode);
  dificultades?: boolean;
};

const OPCIONES_DIFICULTAD: { valor: Dificultad; etiqueta: string; pista: string }[] = [
  { valor: "facil", etiqueta: "Fácil", pista: "Conocimiento básico." },
  { valor: "medio", etiqueta: "Medio", pista: "Sabes de la redonda." },
  { valor: "dificil", etiqueta: "Difícil", pista: "Experto nivel elxokas." },
];

// Un tono por nivel (semáforo: verde/ámbar/rojo) en vez de reutilizar el
// acento del juego -- aquí el color comunica dificultad, no marca. Se
// aplican por inline style (no por clase Tailwind) para que ganen siempre
// a los estilos por defecto de <GameButton>, sin depender del orden en que
// Tailwind vuelque las clases en el CSS final.
const ESTILO_POR_DIFICULTAD: Record<Dificultad, { fondo: string; texto: string }> = {
  facil: { fondo: "#4ADE9A", texto: "#0B1220" },
  medio: { fondo: "#E8A93D", texto: "#241300" },
  dificil: { fondo: "#E0524F", texto: "#FFFFFF" },
};

// Partículas de fondo -- mismas posiciones fijas que en /jugar (Math.random()
// no vale en Server Component; aquí tampoco hace falta, unas pocas quietas
// ya dan el efecto). Aquí se tiñen del acento del juego en vez de ir
// siempre en verde, para que la pantalla "hable" del juego que abres.
const PARTICULAS = [
  { left: "6%", delay: "0s" },
  { left: "18%", delay: "3s" },
  { left: "34%", delay: "1.5s" },
  { left: "58%", delay: "4.5s" },
  { left: "76%", delay: "2s" },
  { left: "90%", delay: "5.5s" },
];

// Pequeño helper para poder fijar la variable CSS --retraso (usada por
// .launcher-entrada en globals.css) desde un `style` normal de React sin
// pelearse con el tipado de CSSProperties, que no conoce props custom.
function conRetraso(segundos: number, extra: CSSProperties = {}): CSSProperties {
  return { ["--retraso" as string]: `${segundos}s`, ...extra } as CSSProperties;
}

export function GameLauncher({ href, children, dificultades = false }: GameLauncherProps) {
  const [empezado, setEmpezado] = useState(false);
  const [dificultad, setDificultad] = useState<Dificultad>("dificil");
  const juego = JUEGOS.find((j) => j.href === href)!;
  const { Icono, nombre, categoria, descripcion, acento, imagen, reto, stats } = juego;

  if (empezado) {
    return <>{typeof children === "function" ? children(dificultad) : children}</>;
  }

  const colorAcento = COLOR_HEX_POR_ACENTO[acento];

  return (
    <div className="relative overflow-hidden px-6 pb-14 pt-8 sm:pt-10">
      {PARTICULAS.map((p, i) => (
        <span
          key={i}
          aria-hidden
          className="particula-flotante pointer-events-none fixed h-[3px] w-[3px] rounded-full opacity-30"
          style={{ left: p.left, animationDelay: p.delay, backgroundColor: colorAcento }}
        />
      ))}

      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-16 h-72 w-[36rem] -translate-x-1/2 rounded-full blur-3xl motion-reduce:hidden"
        style={{ backgroundColor: colorAcento, opacity: 0.16 }}
      />

      <Link
        href="/jugar"
        // Mismo estilo que el botón "Iniciar sesión" del navbar
        // (AccountMenu.tsx) a propósito -- un solo estilo de botón
        // "principal" reconocible en toda la app, en vez de un link de
        // texto suelto.
        className="launcher-entrada relative z-10 mb-8 inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90"
        style={conRetraso(0)}
      >
        <svg viewBox="0 0 20 20" fill="none" className="h-4 w-4" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12.5 15L7.5 10L12.5 5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        Atrás
      </Link>

      <div className="relative z-10 mx-auto grid w-full max-w-4xl items-center gap-10 lg:grid-cols-[1.05fr_1fr] lg:gap-14">
        <CapturaJuego
          Icono={Icono}
          nombre={nombre}
          colorAcento={colorAcento}
          imagen={imagen}
        />

        <div className="flex flex-col items-center gap-4 text-center lg:items-start lg:text-left">
          <span
            className="launcher-entrada rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-widest"
            style={conRetraso(0.05, {
              borderColor: `${colorAcento}66`,
              backgroundColor: `${colorAcento}1a`,
              color: colorAcento,
            })}
          >
            {categoria}
          </span>

          <h1
            className="launcher-entrada text-shimmer bg-clip-text text-4xl font-extrabold tracking-tight text-transparent sm:text-5xl"
            style={conRetraso(0.12, {
              backgroundImage: `linear-gradient(90deg, ${colorAcento}, #ffffff, ${colorAcento})`,
              textShadow: `0 0 24px ${colorAcento}55`,
            })}
          >
            {nombre}
          </h1>

          <p
            className="launcher-entrada max-w-md text-lg font-semibold leading-snug text-foreground/90"
            style={conRetraso(0.2)}
          >
            {reto}
          </p>

          <p
            className="launcher-entrada max-w-md text-sm leading-relaxed text-muted-foreground sm:text-base"
            style={conRetraso(0.28)}
          >
            {descripcion}
          </p>

          <div className="launcher-entrada flex flex-wrap justify-center gap-2 lg:justify-start" style={conRetraso(0.36)}>
            {stats.map((dato) => (
              <span
                key={dato}
                className="rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground"
              >
                {dato}
              </span>
            ))}
          </div>

          {dificultades ? (
            <SelectorDificultad
              onElegir={(elegida) => {
                setDificultad(elegida);
                setEmpezado(true);
              }}
            />
          ) : (
            <GameButton
              onClick={() => setEmpezado(true)}
              className="launcher-entrada mt-2 w-full py-4 font-heading text-lg font-bold tracking-wide sm:w-auto sm:px-12"
              style={conRetraso(0.44)}
            >
              Empezar partida ▸
            </GameButton>
          )}
        </div>
      </div>
    </div>
  );
}

// Selector de nivel para juegos que lo necesiten (de momento, solo el
// 3x3). Reemplaza al botón único "Empezar partida" cuando `dificultades`
// está activado en <GameLauncher>.
function SelectorDificultad({ onElegir }: { onElegir: (dificultad: Dificultad) => void }) {
  return (
    <div
      // Siempre en fila, también en móvil (a petición expresa) -- lo que
      // cambia entre breakpoints es el tamaño de cada botón, no el layout.
      className="launcher-entrada mt-2 flex w-full flex-row justify-center gap-2 sm:w-auto sm:justify-start sm:gap-3"
      style={conRetraso(0.44)}
    >
      {OPCIONES_DIFICULTAD.map(({ valor, etiqueta, pista }) => (
        <div
          key={valor}
          className="flex flex-1 flex-col items-center gap-1 text-center sm:flex-none sm:items-start sm:text-left"
        >
          <GameButton
            onClick={() => onElegir(valor)}
            className="w-full px-1 py-2 font-heading text-xs font-bold tracking-wide sm:w-40 sm:px-4 sm:py-3 sm:text-base"
            style={{ backgroundColor: ESTILO_POR_DIFICULTAD[valor].fondo, color: ESTILO_POR_DIFICULTAD[valor].texto }}
          >
            {etiqueta}
          </GameButton>
          <span className="max-w-[6.5rem] text-[10px] leading-snug text-muted-foreground sm:max-w-[10rem] sm:text-xs">
            {pista}
          </span>
        </div>
      ))}
    </div>
  );
}

// Captura de pantalla del juego (o, si todavía no hay una, un mockup
// estilizado con el icono) con un ligero efecto "tilt" 3D al mover el
// ratón por encima -- da sensación de tarjeta física, en línea con el
// flip-card de JuegoCromo.tsx en /jugar. En móvil el ratón no existe, así
// que simplemente se queda plano (no hace falta gesto táctil equivalente).
function CapturaJuego({
  Icono,
  nombre,
  colorAcento,
  imagen,
}: {
  Icono: (typeof JUEGOS)[number]["Icono"];
  nombre: string;
  colorAcento: string;
  imagen?: string;
}) {
  const marcoRef = useRef<HTMLDivElement>(null);
  const [inclinacion, setInclinacion] = useState({ x: 0, y: 0 });

  function manejarMovimiento(e: MouseEvent<HTMLDivElement>) {
    const marco = marcoRef.current;
    if (!marco) return;
    const rect = marco.getBoundingClientRect();
    const x = (e.clientX - rect.left) / rect.width - 0.5;
    const y = (e.clientY - rect.top) / rect.height - 0.5;
    setInclinacion({ x, y });
  }

  function resetear() {
    setInclinacion({ x: 0, y: 0 });
  }

  return (
    <div
      ref={marcoRef}
      onMouseMove={manejarMovimiento}
      onMouseLeave={resetear}
      className="launcher-entrada launcher-halo-pulso relative mx-auto aspect-[4/3] w-full max-w-md rounded-2xl border border-border bg-card p-1.5 [perspective:1000px]"
      style={conRetraso(0, { ["--glow-color" as string]: `${colorAcento}66` } as CSSProperties)}
    >
      <div
        className="relative h-full w-full overflow-hidden rounded-xl transition-transform duration-200 ease-out [transform-style:preserve-3d]"
        style={{
          transform: `rotateX(${(-inclinacion.y * 8).toFixed(2)}deg) rotateY(${(inclinacion.x * 8).toFixed(2)}deg)`,
        }}
      >
        {imagen ? (
          <Image
            src={imagen}
            alt={`Vista previa de ${nombre}`}
            fill
            className="object-cover"
            sizes="(min-width: 1024px) 480px, 90vw"
            priority
          />
        ) : (
          <div className="flex h-full w-full flex-col" style={{ borderColor: `${colorAcento}40` }}>
            {/* Barra tipo "ventana" -- da la lectura de "esto es una captura",
                aunque de momento sea un mockup a falta de la real. */}
            <div className="flex items-center gap-1.5 border-b border-border bg-muted/40 px-3 py-2.5">
              <span className="h-2.5 w-2.5 rounded-full bg-destructive/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-[#D4AF37]/70" />
              <span className="h-2.5 w-2.5 rounded-full bg-primary/70" />
            </div>
            <div
              className="relative flex flex-1 items-center justify-center"
              style={{
                backgroundImage: `radial-gradient(circle at 1px 1px, ${colorAcento}33 1px, transparent 0)`,
                backgroundSize: "18px 18px",
              }}
            >
              <div
                className="flex h-24 w-24 items-center justify-center rounded-2xl"
                style={{ backgroundColor: `${colorAcento}22`, color: colorAcento }}
              >
                <Icono className="h-12 w-12" />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}