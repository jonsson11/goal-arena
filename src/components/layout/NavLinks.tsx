"use client";

// Antes era un Server Component (solo <Link>s, sin estado). Pasa a
// cliente porque ahora hace falta medir posiciones en el DOM (para el
// indicador deslizante) y saber la ruta activa (usePathname).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useIrAJugar } from "@/features/auth/useIrAJugar";
import { useSolicitudesPendientes } from "@/features/social/SolicitudesContext";

const ENLACES = [
  { href: "/", label: "Inicio" },
  { href: "/jugar", label: "Jugar" },
  { href: "/social", label: "Social" },
  { href: "/perfil", label: "Perfil" },
];

type NavLinksProps = {
  className?: string;
  // La pastilla deslizante asume una fila horizontal (usa left/width con
  // "bottom" fijo). En el menú móvil los links van en columna
  // (flex-col), donde ese cálculo no tiene sentido -- ahí se pasa
  // `mostrarIndicador={false}` y se queda con el subrayado de color al
  // hacer hover/estar activo, sin la pastilla animada.
  mostrarIndicador?: boolean;
};

type Indicador = { left: number; width: number };

export function NavLinks({ className, mostrarIndicador = true }: NavLinksProps) {
  const pathname = usePathname();
  const alClicarJugar = useIrAJugar();
  const { count: solicitudesPendientes } = useSolicitudesPendientes();
  const contenedorRef = useRef<HTMLDivElement>(null);
  const refsEnlaces = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicador, setIndicador] = useState<Indicador | null>(null);
  const indiceActivo = ENLACES.findIndex((e) => e.href === pathname);

  // Pastilla que se desliza bajo el link activo (o el que tiene el
  // ratón encima) -- se calcula midiendo el DOM en vez de con CSS puro
  // porque los links no tienen ancho fijo (cada palabra pesa distinto).
  function moverIndicadorA(indice: number) {
    const el = refsEnlaces.current[indice];
    const contenedor = contenedorRef.current;
    if (!el || !contenedor) return;
    const rectEl = el.getBoundingClientRect();
    const rectContenedor = contenedor.getBoundingClientRect();
    setIndicador({ left: rectEl.left - rectContenedor.left, width: rectEl.width });
  }

  // Al cambiar de página (o al montar), el indicador salta al link de
  // la ruta activa. Si la ruta no es ninguno de los 4 (ej. /login), se
  // oculta -- no tiene sentido dejarlo "pegado" al último visitado.
  useEffect(() => {
    if (!mostrarIndicador) return;
    if (indiceActivo === -1) {
      // Ruta sin link asociado (ej. /login) -- se oculta la pastilla en
      // vez de dejarla "pegada" al último link activo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setIndicador(null);
      return;
    }
    moverIndicadorA(indiceActivo);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, mostrarIndicador]);

  function alSalirDelLink() {
    if (!mostrarIndicador) return;
    if (indiceActivo !== -1) moverIndicadorA(indiceActivo);
    else setIndicador(null);
  }

  return (
    <div
      ref={contenedorRef}
      className={`relative ${className ?? ""}`}
      // El reseteo va en el CONTENEDOR, no en cada <Link> -- si estuviera en
      // cada link, cruzar el hueco entre "Inicio" y "Jugar" (por ejemplo)
      // dispara primero el onMouseLeave del uno (la pastilla vuelve de golpe
      // a su sitio) y al instante el onMouseEnter del otro (salta de nuevo
      // hacia delante), y ese doble salto es justo el "se vuelve loca" que
      // se ve al mover el ratón por encima. Poniéndolo aquí, la pastilla
      // solo se resetea cuando el ratón sale de TODA la barra, no al pasar
      // por los huecos entre enlaces.
      onMouseLeave={alSalirDelLink}
    >
      {mostrarIndicador && indicador && (
        <span
          aria-hidden
          className="absolute -bottom-2 h-[2px] rounded-full bg-primary shadow-[0_0_8px_rgba(74,222,154,0.7)] transition-all duration-300 ease-out"
          style={{ left: indicador.left, width: indicador.width }}
        />
      )}

      {ENLACES.map((enlace, i) => (
        <Link
          key={enlace.href}
          href={enlace.href}
          ref={(el) => {
            refsEnlaces.current[i] = el;
          }}
          onMouseEnter={() => mostrarIndicador && moverIndicadorA(i)}
          // Solo el link "Jugar" necesita el gate de sesión (ver
          // useIrAJugar.ts): sin cuenta, en vez de entrar a /jugar te
          // manda a /login?redirect=/jugar.
          onClick={enlace.href === "/jugar" ? alClicarJugar : undefined}
          className={`relative inline-flex items-center transition-colors hover:text-primary ${
            i === indiceActivo ? "text-primary" : ""
          }`}
        >
          {enlace.label}
          {/* Puntito verde: solicitudes de amistad pendientes. Solo en
              "Social" -- desaparece en cuanto se acepta/rechaza la última
              (ver SolicitudesContext), no al simplemente visitar la página. */}
          {enlace.href === "/social" && solicitudesPendientes > 0 && (
            <span
              aria-label={`${solicitudesPendientes} solicitud${solicitudesPendientes === 1 ? "" : "es"} de amistad pendiente${
                solicitudesPendientes === 1 ? "" : "s"
              }`}
              className="ml-1.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_6px_rgba(74,222,154,0.9)]"
            />
          )}
        </Link>
      ))}
    </div>
  );
}