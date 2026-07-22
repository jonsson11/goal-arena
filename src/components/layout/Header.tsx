"use client";

import { useState } from "react";
import Image from "next/image";
import { NavLinks } from "./NavLinks";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative flex items-center justify-between bg-background px-6 py-4">
      {/* Bloque izquierdo (desktop) */}
      <div className="hidden flex-1 md:flex">
        <NavLinks className="flex gap-4 text-foreground" />
      </div>

      {/* Logo */}
      <Image
        src="/logo-header.jpg"
        alt="Goal Arena"
        width={160}
        height={49}
        priority
        className="flex-none"
      />

      {/* Bloque derecho (desktop) — de momento vacío */}
      <div className="hidden flex-1 justify-end md:flex" />

      {/* Botón hamburguesa (solo móvil) */}
      <button
        className="flex-none text-2xl text-foreground md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {/* Menú desplegable (solo móvil) */}
      {open && (
        <div className="absolute top-full left-0 w-full bg-card md:hidden">
          <NavLinks className="flex flex-col gap-2 p-6 text-card-foreground" />
        </div>
      )}
    </header>
  );
}