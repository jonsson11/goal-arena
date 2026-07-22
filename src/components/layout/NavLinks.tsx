import Link from "next/link";

type NavLinksProps = {
  className?: string;
};

export function NavLinks({ className }: NavLinksProps) {
  return (
    <div className={className}>
      <Link href="/" className="transition-colors hover:text-primary">
        Inicio
      </Link>
      <Link href="/jugar" className="transition-colors hover:text-primary">
        Jugar
      </Link>
      <Link href="/social" className="transition-colors hover:text-primary">
        Social
      </Link>
      <Link href="/perfil" className="transition-colors hover:text-primary">
        Perfil
      </Link>
    </div>
  );
}