const STATS = [
  { valor: "6", etiqueta: "Minijuegos" },
  { valor: "1.200+", etiqueta: "Partidas jugadas" },
  { valor: "350+", etiqueta: "Jugadores activos" },
  { valor: "8", etiqueta: "Jugadores por Arena" },
];

export function StatsSection() {
  return (
    <section className="border-y border-border bg-card/50 px-6 py-14">
      <div className="mx-auto grid max-w-4xl grid-cols-2 gap-8 sm:grid-cols-4">
        {STATS.map((stat) => (
          <div key={stat.etiqueta} className="flex flex-col items-center gap-1">
            <span className="text-3xl font-extrabold text-primary sm:text-4xl">
              {stat.valor}
            </span>
            <span className="text-center text-xs text-muted-foreground sm:text-sm">
              {stat.etiqueta}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}