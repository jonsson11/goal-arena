import Link from "next/link";

export function Navbar() {
  return (
    <nav>
      <Link href="/">Inicio</Link>
      <Link href="/jugar">Jugar</Link>
      <Link href="/perfil">Perfil</Link>
      <Link href="/social">Social</Link>

    </nav>
  );
}