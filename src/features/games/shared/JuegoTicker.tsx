// src/features/games/shared/JuegoTicker.tsx
//
// Cinta de actividad decorativa encima de la lista de juegos. El contenido
// de ahora mismo es de mentira a propósito (no tenemos partidas reales
// registradas todavía -- eso es la fase de "estadísticas/historial" que
// dejamos pendiente). Cuando eso exista, este componente se puede
// alimentar con las últimas partidas reales en vez de ACTIVIDAD_DEMO.

type LineaActividad = { emoji: string; usuario: string; resto: string };

const ACTIVIDAD_DEMO: LineaActividad[] = [
  { emoji: "⚽", usuario: "Carlos_10", resto: "acaba de completar un 3x3 perfecto" },
  { emoji: "🔥", usuario: "MartaGK", resto: "lleva una racha de 14 en Higher or Lower" },
  { emoji: "🏆", usuario: "ElCrack99", resto: "acertó un Top 10 en 38s" },
  { emoji: "⚽", usuario: "Nacho_R", resto: "ha subido al nivel 6" },
];

export function JuegoTicker() {
  // Se repite el contenido dos veces seguidas para que la animación de
  // desplazamiento (-50%) haga un bucle sin salto visible.
  const contenido = [...ACTIVIDAD_DEMO, ...ACTIVIDAD_DEMO];

  return (
    <div className="overflow-hidden border-y border-border bg-white/[0.03] py-2">
      <div className="ticker-movimiento flex w-max gap-14 whitespace-nowrap text-[11.5px] text-muted-foreground">
        {contenido.map((linea, i) => (
          <span key={i}>
            {linea.emoji} <b className="font-bold text-primary">{linea.usuario}</b> {linea.resto}
          </span>
        ))}
      </div>
    </div>
  );
}
