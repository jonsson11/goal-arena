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

export function Footer() {
  return (
    <footer className="mt-auto border-t border-border bg-background px-6 py-8">
      <div className="mx-auto flex max-w-4xl flex-col items-center gap-4 sm:flex-row sm:justify-between">
        <span className="text-xs font-medium tracking-wide text-muted-foreground">
          © 2026 Goal Arena. Todos los derechos reservados.
        </span>

        <div className="flex gap-5">
          <a href="#" aria-label="Instagram" className="text-muted-foreground transition-colors hover:text-primary">
            <IconoInstagram className="h-5 w-5" />
          </a>
          <a href="#" aria-label="TikTok" className="text-muted-foreground transition-colors hover:text-primary">
            <IconoTikTok className="h-5 w-5" />
          </a>
          <a href="#" aria-label="X" className="text-muted-foreground transition-colors hover:text-primary">
            <IconoX className="h-5 w-5" />
          </a>
        </div>
      </div>
    </footer>
  );
}