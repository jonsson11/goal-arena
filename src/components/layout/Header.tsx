"use client";

import { useState } from "react";
import { NavLinks } from "./NavLinks";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative flex items-center justify-between px-6 py-4">
      {/* Bloque izquierdo (desktop) */}
      <div className="hidden flex-1 md:flex">
        <NavLinks className="flex gap-4" />
      </div>

      {/* Logo (siempre visible, no crece ni encoge) */}
      <span className="flex-none font-bold text-lg">Goal Arena</span>

      {/* Bloque derecho (desktop) — de momento vacío */}
      <div className="hidden flex-1 justify-end md:flex" />

      {/* Botón hamburguesa (solo móvil) */}
      <button
        className="flex-none text-2xl md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {/* Menú desplegable (solo móvil, solo si está abierto) */}
      {open && (
        <div className="absolute top-full left-0 w-full bg-slate-950 md:hidden">
          <NavLinks className="flex flex-col gap-2 p-6 text-white" />
        </div>
      )}
    </header>
  );
}