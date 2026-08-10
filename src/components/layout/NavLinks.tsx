"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useIrA } from "@/features/auth/useIrA";
import { useSolicitudesPendientes } from "@/features/social/SolicitudesContext";
import { useLogrosReclamables } from "@/features/profile/LogrosReclamablesContext";

const ENLACES = [
  { href: "/", label: "Inicio" },
  { href: "/jugar", label: "Un Jugador" },
  { href: "/multijugador", label: "Multijugador" },
  { href: "/social", label: "Social" },
  { href: "/perfil", label: "Perfil" },
];

type NavLinksProps = {
  className?: string;
  mostrarIndicador?: boolean;
};

type Indicador = { left: number; width: number };

export function NavLinks({ className, mostrarIndicador = true }: NavLinksProps) {
  const pathname = usePathname();
  const alClicarJugar = useIrA("/jugar");
  const alClicarMultijugador = useIrA("/multijugador");
  const { count: solicitudesPendientes } = useSolicitudesPendientes();
  const { count: logrosReclamables } = useLogrosReclamables();
  const contenedorRef = useRef<HTMLDivElement>(null);
  const refsEnlaces = useRef<Array<HTMLAnchorElement | null>>([]);
  const [indicador, setIndicador] = useState<Indicador | null>(null);
  const indiceActivo = ENLACES.findIndex((e) => e.href === pathname);

  function moverIndicadorA(indice: number) {
    const el = refsEnlaces.current[indice];
    const contenedor = contenedorRef.current;
    if (!el || !contenedor) return;
    const rectEl = el.getBoundingClientRect();
    const rectContenedor = contenedor.getBoundingClientRect();
    setIndicador({ left: rectEl.left - rectContenedor.left, width: rectEl.width });
  }

  useEffect(() => {
    if (!mostrarIndicador) return;
    if (indiceActivo === -1) {
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
          onClick={
            enlace.href === "/jugar"
              ? alClicarJugar
              : enlace.href === "/multijugador"
                ? alClicarMultijugador
                : undefined
          }
          className={`relative inline-flex shrink-0 items-center whitespace-nowrap transition-colors hover:text-primary ${
            i === indiceActivo ? "text-primary" : ""
          }`}
        >
          {enlace.label}
          {enlace.href === "/social" && solicitudesPendientes > 0 && (
            <span
              aria-label={`${solicitudesPendientes} solicitud${solicitudesPendientes === 1 ? "" : "es"} de amistad pendiente${
                solicitudesPendientes === 1 ? "" : "s"
              }`}
              className="ml-1.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_6px_rgba(74,222,154,0.9)]"
            />
          )}
          {enlace.href === "/perfil" && logrosReclamables > 0 && (
            <span
              aria-label={`${logrosReclamables} logro${logrosReclamables === 1 ? "" : "s"} para reclamar`}
              className="ml-1.5 h-2 w-2 shrink-0 rounded-full bg-primary shadow-[0_0_6px_rgba(74,222,154,0.9)]"
            />
          )}
        </Link>
      ))}
    </div>
  );
}