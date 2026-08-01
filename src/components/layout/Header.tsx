"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NavLinks } from "./NavLinks";
import { AccountMenu } from "./AccountMenu";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const pathname = usePathname();

  // Cierra el menú móvil solo cuando la ruta cambia de verdad (no al
  // montar) -- así abrir el menú justo después de cargar la página no lo
  // cierra de golpe. Cubre tanto un click normal en un link (cambia la
  // ruta al momento) como el guard de "Jugar" sin sesión, que redirige a
  // /login: en ambos casos pathname cambia y el menú se cierra solo, en
  // vez de quedarse abierto tapando la pantalla hasta que alguien lo
  // cierre a mano.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  // Sticky con "glass": mientras estás arriba del todo, fondo sólido
  // normal; en cuanto empiezas a bajar, pasa a semitransparente +
  // blur y el borde inferior coge un brillo sutil. El umbral (8px) es
  // para no activarlo por una micro-vibración de scroll.
  useEffect(() => {
    function alHacerScroll() {
      setScrolled(window.scrollY > 8);
    }
    alHacerScroll();
    window.addEventListener("scroll", alHacerScroll, { passive: true });
    return () => window.removeEventListener("scroll", alHacerScroll);
  }, []);

  return (
    <header
      className={`header-scan-border sticky top-0 z-50 flex items-center justify-between gap-4 border-b px-6 py-3 transition-colors duration-300 ${
        scrolled
          ? "border-primary/20 bg-background/70 shadow-[0_4px_30px_-10px_rgba(74,222,154,0.35)] backdrop-blur-md"
          : "border-border bg-background"
      }`}
    >
      {/* Marca: logo oficial (icono + texto en una sola imagen) a la
          izquierda (modelo 2). Coloca tu archivo en
          public/logo-completo.png -- si prefieres otro nombre, cambia
          solo el `src` de aquí abajo. El alto (h-9) está pensado para un
          logo horizontal tipo wordmark; si el tuyo es más cuadrado,
          ajusta width/height y la clase de alto a la vez para no
          deformarlo. */}
      <Link href="/" className="group relative flex flex-1 items-center">
        <span
          aria-hidden
          className="absolute -left-2 h-11 w-11 -z-10 scale-150 rounded-full bg-primary/25 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
        />
        <span className="logo-flip-wrap flex-none">
          <Image
            src="/LOGO ARENA-ConLetra.png"
            alt="Goal Arena"
            width={160}
            height={36}
            priority
            className="logo-flip h-9"
            style={{ width: "auto" }}
          />
        </span>
      </Link>

      {/* Menú centrado con pastilla deslizante (modelo 1) */}
      <div className="hidden flex-1 justify-center md:flex">
        <NavLinks className="flex gap-6 text-sm font-semibold uppercase tracking-wide text-foreground" />
      </div>

      {/* Cuenta (login o avatar) + hamburguesa agrupados a la derecha.
          Antes la cuenta solo aparecía en escritorio y en móvil quedaba
          escondida dentro del desplegable -- ahora se ve siempre,
          también en móvil, a la izquierda del botón de hamburguesa. */}
      <div className="flex flex-1 items-center justify-end gap-3">
        <AccountMenu />

        <button
          className="flex-none text-2xl text-foreground md:hidden"
          onClick={() => setOpen(!open)}
          aria-label={open ? "Cerrar menú" : "Abrir menú"}
        >
          <span
            className="inline-block transition-transform duration-300"
            style={{ transform: open ? "rotate(90deg)" : "rotate(0deg)" }}
          >
            {open ? "✕" : "☰"}
          </span>
        </button>
      </div>

      {open && (
        <div className="animate-in fade-in slide-in-from-top-2 absolute left-0 top-full w-full border-t border-border bg-card/95 backdrop-blur-md duration-200 md:hidden">
          <NavLinks
            mostrarIndicador={false}
            className="flex flex-col gap-4 p-6 text-sm font-semibold uppercase tracking-wide text-card-foreground"
          />
        </div>
      )}
    </header>
  );
}