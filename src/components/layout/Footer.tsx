function IconoInstagram({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="3" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="17.2" cy="6.8" r="1.1" fill="currentColor" />
    </svg>
  );
}

function IconoTikTok({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path
        d="M15 3v10.5a3.5 3.5 0 1 1-3.5-3.5c.34 0 .68.04 1 .12V7.6a6.1 6.1 0 1 0 5 6V9.8a7.6 7.6 0 0 0 4-1.15V6.1A5.5 5.5 0 0 1 17.5 3H15Z"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconoX({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} xmlns="http://www.w3.org/2000/svg">
      <path d="M4 4 L20 20 M20 4 L4 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

// Estilo común de los 3 iconos sociales: al hacer hover se levantan un
// poco, giran ligeramente y sueltan un resplandor verde -- mismo
// lenguaje de "glow" que ya usa el resto de la app (halos, sombras de
// color), no un efecto nuevo inventado para el footer.
const ICONO_SOCIAL =
  "text-muted-foreground transition-all duration-300 hover:-translate-y-1 hover:rotate-6 hover:scale-110 hover:text-primary hover:drop-shadow-[0_0_10px_rgba(74,222,154,0.6)]";

export function Footer() {
  return (
    <footer className="relative mt-auto overflow-hidden border-t border-border bg-background px-6 py-8">
      {/* Detalle "extravagante" #1: una lucecita (como un foco de
          estadio) que recorre el borde superior del footer de vez en
          cuando, de izquierda a derecha, en bucle. Puramente decorativo
          (aria-hidden), no interactivo. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-px overflow-hidden">
        <div className="footer-scan-line h-full w-1/3 bg-gradient-to-r from-transparent via-primary/80 to-transparent" />
      </div>

      <div className="mx-auto flex max-w-4xl flex-col items-center gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col items-center gap-2 text-center sm:items-start sm:text-left">
          <span className="text-xs font-medium tracking-wide text-muted-foreground">
            © 2026 Goal Arena. Todos los derechos reservados.
          </span>
          <p className="max-w-sm text-[11px] leading-relaxed text-muted-foreground/70">
            Las imágenes de jugadores mostradas en la web proceden de Wikipedia. Todos los
            créditos a sus autores originales y a la comunidad de Wikipedia.
          </p>
        </div>

        <div className="flex gap-5">
          <a href="#" aria-label="Instagram" className={ICONO_SOCIAL}>
            <IconoInstagram className="h-5 w-5" />
          </a>
          <a href="#" aria-label="TikTok" className={ICONO_SOCIAL}>
            <IconoTikTok className="h-5 w-5" />
          </a>
          <a href="#" aria-label="X" className={ICONO_SOCIAL}>
            <IconoX className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}