export function ArenasTeaser() {
  return (
    <section className="mx-auto flex max-w-3xl flex-col items-center gap-4 px-6 py-16 text-center">
      <span className="rounded-full border border-secondary/40 bg-secondary/10 px-4 py-1 text-xs font-bold uppercase tracking-widest text-secondary">
        Próximamente
      </span>

      <h2 className="text-2xl font-extrabold tracking-tight text-foreground sm:text-3xl">
        Las Arenas
      </h2>

      <p className="text-muted-foreground">
        Enfréntate en vivo a hasta 8 jugadores en salas de varias rondas.
        Por ejemplo: una ronda de <span className="font-semibold text-foreground">3x3</span>,
        una de <span className="font-semibold text-foreground">Top 10</span> y una de{" "}
        <span className="font-semibold text-foreground">Higher or Lower</span> — el mismo
        reto para todos, al mismo tiempo. Gana quien sume más puntos al final.
      </p>
    </section>
  );
}