"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { NavLinks } from "./NavLinks";
import { AccountMenu } from "./AccountMenu";

export default function Header() {
  const [open, setOpen] = useState(false);

  return (
    <header className="relative flex items-center justify-between border-b border-border bg-background px-6 py-3">
      <div className="hidden flex-1 md:flex">
        <NavLinks className="flex gap-6 text-sm font-semibold uppercase tracking-wide text-foreground" />
      </div>

      <Link href="/" className="flex-none transition-opacity hover:opacity-80">
        <Image
          src="/logo-icon.png"
          alt="Goal Arena"
          width={44}
          height={44}
          priority
          className="h-11 w-11"
        />
      </Link>

      <div className="hidden flex-1 justify-end md:flex">
        <AccountMenu />
      </div>

      <button
        className="flex-none text-2xl text-foreground md:hidden"
        onClick={() => setOpen(!open)}
        aria-label="Abrir menú"
      >
        ☰
      </button>

      {open && (
        <div className="absolute top-full left-0 w-full border-t border-border bg-card md:hidden">
          <NavLinks className="flex flex-col gap-4 p-6 text-sm font-semibold uppercase tracking-wide text-card-foreground" />
          <div className="border-t border-border p-6">
            <AccountMenu />
          </div>
        </div>
      )}
    </header>
  );
}