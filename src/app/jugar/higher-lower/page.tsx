// src/app/jugar/higher-lower/page.tsx
//
// OJO: NO se importa HigherLowerGame aquí a propósito. Ese componente
// (via src/features/games/higher-lower/logic.ts) importa
// "@/features/games/shared/data", un archivo que nunca llegó a crearse
// -- el juego está roto de fábrica, no algo que rompiera esta sesión.
// Mientras no se conecte a datos reales (como ya se hizo con 3x3 y
// Top10), esta página se queda con un aviso de "en desarrollo" en vez
// de intentar renderizar el juego, para que ni cargar la página ni
// pulsar "Empezar partida" rompan nada.
import { GameLauncher } from "@/features/games/shared/GameLauncher";

export default function HigherLowerPage() {
  return (
    <GameLauncher href="/jugar/higher-lower">
      <div className="flex flex-col items-center gap-4 px-6 py-16 text-center">
        <span className="rounded-full border border-secondary/40 bg-secondary/10 px-3 py-1 text-[11px] font-bold uppercase tracking-widest text-secondary">
          En desarrollo
        </span>
        <h2 className="text-2xl font-extrabold tracking-tight text-foreground">
          Higher or Lower está en obras 🚧
        </h2>
        <p className="max-w-md text-sm leading-relaxed text-muted-foreground">
          Estamos terminando de conectarlo a la base de datos real. Vuelve pronto -- mientras
          tanto puedes probar el 3x3 o el Top 10.
        </p>
      </div>
    </GameLauncher>
  );
}
