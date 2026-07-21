import Link from "next/link";

type NavLinksProps = {
  className?: string;
};

export function NavLinks({ className }: NavLinksProps) {
  return (
    <div className={className}>
      <Link href="/">Inicio</Link>
      <Link href="/jugar">Jugar</Link>
      <Link href="/social">Social</Link>
      <Link href="/perfil">Perfil</Link>
    </div>
  );
}