"use client";

import Link from "next/link";
import Image from "next/image";
import { User, Users } from "lucide-react";
import { useIrA } from "@/features/auth/useIrA";

export function HeroSection() {
  const alClicarJugar = useIrA("/jugar");
  const alClicarMultijugador = useIrA("/multijugador");

  return (
    <section className="flex flex-col items-center gap-6 px-6 py-20 text-center">
      <Image
        src="/LOGO ARENA-ConLetra.png"
        alt="Goal Arena"
        // Mismo archivo que en el Header (1000x300px reales, ratio 10:3).
        // 340x104 no respetaba esa proporción exacta -- ver el comentario
        // largo en Header.tsx para el porqué. Aquí no se veía el aviso
        // en consola porque esta imagen solo aparece en "/", pero el
        // desajuste era el mismo; 340x102 sí es 10:3 exacto.
        width={340}
        height={102}
        priority
        className="h-auto w-56 sm:w-72"
      />

      <h1 className="max-w-2xl text-3xl font-extrabold tracking-tight text-foreground sm:text-5xl">
        Demuestra cuánto sabes de fútbol.{" "}
        <span className="text-primary">En minutos.</span>
      </h1>

      <p className="max-w-xl text-base text-muted-foreground sm:text-lg">
        Retos rápidos, muy rejugables, y hechos para presumir con tus amigos.
        Sin apps, sin descargas, directo desde el navegador.
      </p>

      {/* Un Jugador / Multijugador -- antes había un único CTA "Jugar
          ahora" directo a /jugar. Con el multijugador ya real (no solo
          "Próximamente" como en ArenasTeaser más abajo), hace falta elegir
          entre los dos desde el principio. */}
      <div className="mt-2 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/jugar"
          onClick={alClicarJugar}
          className="flex items-center justify-center gap-2 rounded-lg bg-primary px-8 py-4 text-lg font-bold text-primary-foreground shadow-[0_0_30px_-6px_rgba(74,222,154,0.6)] transition-transform duration-200 hover:scale-105"
        >
          <User className="h-5 w-5" />
          Un jugador
        </Link>
        <Link
          href="/multijugador"
          onClick={alClicarMultijugador}
          className="flex items-center justify-center gap-2 rounded-lg bg-secondary px-8 py-4 text-lg font-bold text-secondary-foreground shadow-[0_0_30px_-6px_rgba(29,122,156,0.5)] transition-transform duration-200 hover:scale-105"
        >
          <Users className="h-5 w-5" />
          Multijugador
        </Link>
      </div>
    </section>
  );
}