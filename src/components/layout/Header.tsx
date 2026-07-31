"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { AccountMenu } from "./AccountMenu";

export default function Header() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

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
      className={`header-scan-border sticky top-0 z-50 flex items-center justify-between border-b px-6 py-3 transition-colors duration-300 ${
        scrolled
          ? "border-primary/20 bg-background/70 shadow-[0_4px_30px_-10px_rgba(74,222,154,0.35)] backdrop-blur-md"
          : "border-border bg-background"
      }`}
    >
      <div className="hidden flex-1 md:flex">
        <NavLinks className="flex gap-6 text-sm font-semibold uppercase tracking-wide text-foreground" />
      </div>

      <Link href="/" className="group relative flex-none">
        {/* Halo que aparece detrás del logo al hacer hover -- sutil, no
            un círculo sólido, solo un resplandor. */}
        <span
          aria-hidden
          className="absolute inset-0 -z-10 scale-150 rounded-full bg-primary/25 opacity-0 blur-xl transition-opacity duration-300 group-hover:opacity-100"
        />
        <Image
          src="/logo-icon.png"
          alt="Goal Arena"
          width={44}
          height={44}
          priority
          className="logo-kick h-11 w-11"
        />
      </Link>

      <div className="hidden flex-1 justify-end md:flex">
        <AccountMenu />
      </div>

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

      {open && (
        <div className="animate-in fade-in slide-in-from-top-2 absolute left-0 top-full w-full border-t border-border bg-card/95 backdrop-blur-md duration-200 md:hidden">
          <NavLinks
            mostrarIndicador={false}
            className="flex flex-col gap-4 p-6 text-sm font-semibold uppercase tracking-wide text-card-foreground"
          />
          <div className="border-t border-border p-6">
            <AccountMenu />
          </div>
        </div>
      )}
    </header>
  );
}