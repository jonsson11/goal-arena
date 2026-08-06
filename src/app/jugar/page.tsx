import { JUEGOS } from "@/features/games/shared/juegos";
import { JuegoCromo } from "@/features/games/shared/JuegoCromo";
import { BotonAtras } from "@/features/games/shared/BotonAtras";
import { TituloPagina } from "@/components/layout/TituloPagina";

export default function JugarPage() {
  return (
    <div className="relative px-6 pb-14 pt-6 sm:pt-8">
      {/* Fuera de la columna centrada de abajo, pegado al borde real de
          la pantalla -- mismo criterio que ya usan las pantallas de
          multijugador (ver comentario largo en esas páginas). */}
      <BotonAtras href="/" />

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-2">
        <TituloPagina acento="verde">Un jugador</TituloPagina>
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