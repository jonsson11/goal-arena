import Link from "next/link";

export function ArenasTeaser() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="rounded-full border border-secondary/40 bg-secondary/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-secondary">
        Multijugador
      </span>

      <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
        Reta a tus amigos en directo
      </h2>

      <p className="text-muted-foreground">
        Crea una sala de hasta <span className="font-semibold text-foreground">8 jugadores</span> y
        enfrentaos al mismo <span className="font-semibold text-foreground">3x3</span> a la vez, con
        el mismo tablero y el mismo tiempo para todos. Gana quien lo complete antes o quien más
        acierte cuando se acabe el reloj.
      </p>

      <Link
        href="/multijugador"
        className="mt-2 rounded-lg border border-secondary bg-secondary/10 px-6 py-2.5 text-sm font-bold text-secondary transition-transform duration-200 hover:scale-105"
      >
        Crear o unirte a una sala
      </Link>
    </section>
  );
}