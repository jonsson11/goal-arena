import { JUEGOS } from "@/features/games/shared/juegos";
import { JuegoCromo } from "@/features/games/shared/JuegoCromo";
import { TituloPagina } from "@/components/layout/TituloPagina";

export default function JugarPage() {
  return (
    <div className="relative px-6 pb-14 pt-4 sm:pt-6">
      <TituloPagina acento="verde" hrefAtras="/" className="mb-2">
        Un jugador
      </TituloPagina>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-2">
        <p className="mb-8 text-center text-sm text-muted-foreground">
          Elige uno de los minijuegos y entra directo a jugar.
        </p>

        <div className="grid w-full grid-cols-1 gap-9 sm:grid-cols-3">
          {JUEGOS.map(({ Icono, ...juego }) => (
            <JuegoCromo key={juego.href} juego={juego} icono={<Icono className="h-9 w-9" />} />
          ))}
        </div>
      </div>
    </div>
  );
}